// src/lib/api/client.ts
import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

class ApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, { headers });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw { detail: error.detail || res.statusText, status: res.status };
    }

    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw { detail: error.detail || res.statusText, status: res.status };
    }

    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw { detail: error.detail || res.statusText, status: res.status };
    }

    return res.json();
  }

  async delete(path: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw { detail: error.detail || res.statusText, status: res.status };
    }
  }
}

export const api = new ApiClient();