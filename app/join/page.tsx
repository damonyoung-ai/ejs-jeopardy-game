import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<div className="card w-full max-w-lg">Loading...</div>}>
        <JoinClient />
      </Suspense>
    </main>
  );
}
