"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

type Tool = "merge" | "split";

const tools = [
  { id: "merge" as Tool, icon: "↔", title: "Merge PDF", text: "Combine multiple PDFs into one file." },
  { id: "split" as Tool, icon: "✂", title: "Split PDF", text: "Extract selected pages into a new PDF." },
];

export default function Home() {
  const [tool, setTool] = useState<Tool>("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const pdfs = Array.from(list).filter((file) => file.type === "application/pdf");
    setFiles((current) => [...current, ...pdfs]);
    setMessage("");
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  async function mergePdfs() {
    if (files.length < 2) {
      setMessage("Select at least 2 PDF files.");
      return;
    }
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const file of files) {
        const source = await PDFDocument.load(await file.arrayBuffer());
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      const bytes = await merged.save();
      download(bytes, "pdfera-merged.pdf");
      setMessage("Merged PDF downloaded successfully.");
    } catch {
      setMessage("Could not process one of the PDFs.");
    } finally {
      setBusy(false);
    }
  }

  async function splitPdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF for Split PDF.");
      return;
    }
    setBusy(true);
    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      if (source.getPageCount() < 2) {
        setMessage("This PDF has only one page.");
        return;
      }
      const firstPage = await PDFDocument.create();
      const copied = await firstPage.copyPages(source, [0]);
      firstPage.addPage(copied[0]);
      download(await firstPage.save(), "pdfera-page-1.pdf");
      setMessage("First page extracted and downloaded.");
    } catch {
      setMessage("Could not process the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function process() {
    if (tool === "merge") await mergePdfs();
    else await splitPdf();
  }

  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-black tracking-tight">PDF<span className="text-[#ccff00]">era</span></div>
        <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">Free • Browser based</span>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.25em] text-[#ccff00]">PDF tools, made simple</p>
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
          Work with PDFs.<br /><span className="text-white/35">No complicated setup.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
          PDFera is a lightweight Smallpdf-style toolkit. Files are processed directly in your browser for this MVP.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-10 sm:grid-cols-2">
        {tools.map((item) => (
          <button key={item.id} onClick={() => { setTool(item.id); setFiles([]); setMessage(""); }}
            className={`rounded-3xl border p-6 text-left transition hover:-translate-y-1 ${tool === item.id ? "border-[#ccff00]/60 bg-[#ccff00]/8" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="mb-8 text-3xl">{item.icon}</div>
            <h2 className="text-xl font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-white/45">{item.text}</p>
          </button>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 sm:p-10">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{tool === "merge" ? "Merge your PDFs" : "Split your PDF"}</h2>
              <p className="mt-1 text-sm text-white/40">{tool === "merge" ? "Add two or more PDF files." : "Add one PDF. The MVP extracts page 1."}</p>
            </div>
            {files.length > 0 && <button onClick={() => setFiles([])} className="text-sm text-white/40 hover:text-white">Clear</button>}
          </div>

          <input ref={inputRef} type="file" accept="application/pdf" multiple={tool === "merge"} className="hidden"
            onChange={(e) => addFiles(e.target.files)} />

          <button onClick={() => inputRef.current?.click()}
            className="flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black/30 px-6 text-center hover:border-[#ccff00]/50">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ccff00] text-2xl text-black">↑</div>
            <strong>Click to choose PDF{tool === "merge" ? "s" : ""}</strong>
            <span className="mt-2 text-sm text-white/35">Your files stay in the browser during processing.</span>
          </button>

          {files.length > 0 && (
            <div className="mt-5 space-y-2">
              {files.map((file, index) => (
                <div key={file.name + index} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="truncate text-sm">{index + 1}. {file.name}</span>
                  <button onClick={() => removeFile(index)} className="ml-4 text-xs text-white/40 hover:text-white">Remove</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={process} disabled={busy}
            className="mt-6 w-full rounded-2xl bg-[#ccff00] px-6 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Processing..." : tool === "merge" ? "Merge PDF →" : "Extract Page 1 →"}
          </button>

          {message && <p className="mt-4 text-center text-sm text-[#ccff00]">{message}</p>}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/30">
        PDFera • Built as a free-first PDF toolkit
      </footer>
    </main>
  );
}

function download(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}