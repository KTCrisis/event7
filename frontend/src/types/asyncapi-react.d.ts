declare module "@asyncapi/react-component" {
  import { ComponentType } from "react";

  interface AsyncApiProps {
    schema: string | Record<string, unknown>;
    config?: Record<string, unknown>;
  }

  const AsyncApiComponent: ComponentType<AsyncApiProps>;
  export default AsyncApiComponent;
}

declare module "@asyncapi/react-component/styles/default.min.css";