"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui";
import { IslLoader } from "@/components/isl-loader";
import { createClient } from "@/lib/supabase/client";
import { readWeekMaterials } from "@/app/actions/workshops";

// Picks the week's slides / workshop instructions (PDF). The files go
// straight from the browser to storage (so big slide decks aren't limited by
// the server's upload size), then the server has the AI read them.
export function ReadMaterials({ workshopId, again }: { workshopId: string; again: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run(files: File[]) {
    setError(null);
    if (files.some((f) => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"))) {
      setError("Please choose PDF files. Export PowerPoint or Google Slides as PDF first.");
      return;
    }
    setStep("uploading");
    const supabase = createClient();
    const uploaded: { name: string; path: string }[] = [];
    for (const file of files) {
      const path = `workshops/${workshopId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) {
        setError(`Couldn't upload ${file.name}: ${uploadError.message}`);
        setStep("idle");
        return;
      }
      uploaded.push({ name: file.name, path });
    }
    setStep("reading");
    const result = await readWeekMaterials(workshopId, uploaded).catch(() => ({ error: "Something went wrong. Please try again." }));
    setStep("idle");
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) run(files);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" disabled={step !== "idle"} onClick={() => inputRef.current?.click()}>
          {again ? "Read new slides" : "Upload slides (PDF)"}
        </PrimaryButton>
        <span className="text-xs text-foreground-muted">Slides and workshop instructions; you can pick several files.</span>
      </div>
      {step !== "idle" && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-isl-blue-pale bg-isl-blue-pale/50 p-3 text-sm text-foreground">
          <IslLoader size={22} label="Reading slides" />
          {step === "uploading" ? "Uploading…" : "Reading the slides… this takes about half a minute."}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
