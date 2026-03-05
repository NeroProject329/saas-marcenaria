import { Suspense } from "react";
import AssinaturasClient from "./AssinaturasClient";

export default function AssinaturasPage() {
  return (
    <Suspense fallback={null}>
      <AssinaturasClient />
    </Suspense>
  );
}