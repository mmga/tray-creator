"use client";

import dynamic from "next/dynamic";
import { EditorBootstrapFallback } from "./EditorBootstrapFallback";

const TrayCreatorEditorRuntime = dynamic(
  () => import("./TrayCreatorEditorRuntime"),
  {
    ssr: false,
    loading: EditorBootstrapFallback,
  },
);

export default function Home() {
  return <TrayCreatorEditorRuntime />;
}
