"""
event7 - Test rapide du ConfluentProvider
Lance avec: python -m scripts.test_confluent

Pré-requis: renseigner CONFLUENT_SR_URL, CONFLUENT_SR_API_KEY, CONFLUENT_SR_API_SECRET dans .env
"""

import asyncio
import os
import sys

# Ajoute le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from app.providers.confluent import ConfluentProvider


async def main():
    url = os.getenv("CONFLUENT_SR_URL")
    key = os.getenv("CONFLUENT_SR_API_KEY")
    secret = os.getenv("CONFLUENT_SR_API_SECRET")

    if not url:
        print("❌ CONFLUENT_SR_URL non configuré dans .env")
        print("   Décommente et remplis les 3 variables CONFLUENT_SR_* dans .env")
        return

    print(f"🔌 Connexion à {url}")
    provider = ConfluentProvider(base_url=url, api_key=key, api_secret=secret)

    # 1. Health check
    print("\n--- Health Check ---")
    healthy = await provider.health_check()
    print(f"   {'✅' if healthy else '❌'} Registry {'accessible' if healthy else 'inaccessible'}")
    if not healthy:
        await provider.close()
        return

    # 2. List subjects
    print("\n--- Subjects ---")
    subjects = await provider.list_subjects()
    print(f"   📋 {len(subjects)} subjects trouvés")
    for s in subjects[:10]:  # Max 10 pour l'affichage
        print(f"      • {s.subject} (v{s.latest_version}, {s.format.value}, {s.version_count} versions)")
    if len(subjects) > 10:
        print(f"      ... et {len(subjects) - 10} autres")

    # 3. Détail du premier subject
    if subjects:
        first = subjects[0].subject
        print(f"\n--- Détail: {first} ---")
        schema = await provider.get_schema(first)
        print(f"   Format: {schema.format.value}")
        print(f"   Version: {schema.version}")
        print(f"   Schema ID: {schema.schema_id}")
        print(f"   References: {len(schema.references)}")

        # Champs (si Avro record)
        content = schema.schema_content
        if content.get("type") == "record":
            fields = content.get("fields", [])
            print(f"   Fields: {len(fields)}")
            for f in fields[:5]:
                print(f"      • {f['name']}: {f.get('type', '?')}")

        # 4. Versions
        versions = await provider.get_subject_versions(first)
        print(f"\n--- Versions: {first} ---")
        print(f"   Versions: {versions}")

        # 5. Diff (si > 1 version)
        if len(versions) >= 2:
            print(f"\n--- Diff: v{versions[-2]} → v{versions[-1]} ---")
            diff = await provider.diff_versions(first, versions[-2], versions[-1])
            print(f"   Breaking: {'⚠️ OUI' if diff.is_breaking else '✅ NON'}")
            print(f"   Summary: {diff.summary}")
            for change in diff.changes[:10]:
                icon = {"added": "➕", "removed": "➖", "modified": "🔄"}.get(change.change_type.value, "•")
                print(f"   {icon} {change.field_path}: {change.details or change.change_type.value}")

        # 6. Compatibility
        print(f"\n--- Compatibilité: {first} ---")
        compat = await provider.get_compatibility(first)
        print(f"   Mode: {compat.value}")

    await provider.close()
    print("\n✅ Test terminé")


if __name__ == "__main__":
    asyncio.run(main())
