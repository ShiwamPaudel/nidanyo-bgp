"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadLabAsset, removeLabAsset } from "@/lib/actions/settings-actions";

export function AssetUploader({
  kind,
  ownerUserId,
  currentUrl,
  currentId,
  label,
  hint,
  aspect = "wide",
}: {
  kind: string;
  ownerUserId?: string;
  currentUrl?: string | null;
  currentId?: string | null;
  label: string;
  hint?: string;
  aspect?: "wide" | "square";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("kind", kind);
    if (ownerUserId) fd.set("ownerUserId", ownerUserId);
    fd.set("file", file);
    start(async () => {
      const res = await uploadLabAsset(fd);
      if (res.ok) { toast.success(res.message ?? "Uploaded"); router.refresh(); }
      else { toast.error(res.error); setPreview(currentUrl ?? null); }
    });
  }

  function remove() {
    if (!currentId) return;
    start(async () => {
      const res = await removeLabAsset(currentId);
      if (res.ok) { toast.success("Removed"); setPreview(null); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {preview && currentId && <Button variant="ghost" size="sm" className="text-destructive" onClick={remove} loading={pending}><Trash2 className="size-4" /> Remove</Button>}
      </div>
      <div className={`flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface ${aspect === "wide" ? "h-28" : "size-28"}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground"><ImageIcon className="size-6" /><span className="text-xs">No image</span></div>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <Button variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()} loading={pending}><Upload className="size-4" /> {preview ? "Replace" : "Upload"}</Button>
    </div>
  );
}
