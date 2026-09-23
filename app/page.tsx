"use client";

import { DragEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

type Tool = "merge" | "split" | "jpg";

const tools = [
  { id: "merge" as Tool, icon: "↔", title: "Merge PDF", text: "Combine multiple PDFs into one file." },
  { id: "split" as Tool, icon: "✂", title: "Split PDF", text: "Extract a page range into a new PDF." },
  { id: "jpg" as Tool, icon: "▣", title: "JPG to PDF", text: "Turn JPG or PNG images into a PDF." },
];

export default function Home() {
  const [tool, setTool] = useState<Tool>("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pageRange, setPageRange] = useState("1");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const selected = Array.from(list);
    const allowed = tool === "jpg"
      ? selected.filter((file) => file.type === "image/jpeg" || file.type === "image/png")
      : selected.filter((file) => file.type === "application/pdf");

    if (allowed.length === 0) {
      setMessage(tool === "jpg" ? "Please select JPG or PNG images." : "Please select PDF files.");
      return;
    }

    setFiles((current) => [...current, ...allowed]);
    setMessage("");
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
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

      download(await merged.save(), "pdfera-merged.pdf");
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

    const source = await PDFDocument.load(await files[0].arrayBuffer());
    const totalPages = source.getPageCount();
    const parts = pageRange
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const pageNumbers: number[] = [];

    for (const part of parts) {
      if (part.includes("-")) {
        const range = part.split("-");
        const start = Number(range[0]);
        const end = Number(range[1]);

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > totalPages || start > end) {
          setMessage("Invalid page range. Example: 1-3,5");
          return;
        }

        for (let page = start; page <= end; page++) {
          if (!pageNumbers.includes(page)) pageNumbers.push(page);
        }
      } else {
        const page = Number(part);

        if (!Number.isInteger(page) || page < 1 || page > totalPages) {
          setMessage("Invalid page number. Example: 1,3,5");
          return;
        }

        if (!pageNumbers.includes(page)) pageNumbers.push(page);
      }
    }

    if (pageNumbers.length === 0) {
      setMessage("Enter pages like 1,3,5 or 1-3.");
      return;
    }

    setBusy(true);
    try {
      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, pageNumbers.map((page) => page - 1));
      copied.forEach((page) => output.addPage(page));

      download(await output.save(), "pdfera-split.pdf");
      setMessage("Selected pages downloaded successfully.");
    } catch {
      setMessage("Could not split the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function imagesToPdf() {
    if (files.length === 0) {
      setMessage("Select at least 1 JPG or PNG image.");
      return;
    }

    setBusy(true);
    try {
      const pdf = await PDFDocument.create();

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const image = file.type === "image/png"
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);

        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      download(await pdf.save(), "pdfera-images.pdf");
      setMessage("PDF created from images successfully.");
    } catch {
      setMessage("Could not convert the selected images.");
    } finally {
      setBusy(false);
    }
  }

  async function process() {
    if (tool === "merge") await mergePdfs();
    else if (tool === "split") await splitPdf();
    else await imagesToPdf();
  }

  function selectTool(nextTool: Tool) {
    setTool(nextTool);
    setFiles([]);
    setMessage("");
    setPageRange("1");
  }

  const accept = tool === "jpg" ? "image/jpeg,image/png" : "application/pdf";
  const multiple = tool !== "split";

  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-black tracking-tight">
          PDF<span className="text-[#ccff00]">era</span>
        </div>
        <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">
          Free • Browser based
        </span>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-10 text-center">
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.25em] text-[#ccff00]">
          PDF tools, made simple
        </p>
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
          Work with PDFs.
          <br />
          <span className="text-white/35">No complicated setup.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
          Merge, split, and convert files directly in your browser. No account and no permanent file storage.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-10 md:grid-cols-3">
        {tools.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTool(item.id)}
            className={`rounded-3xl border p-6 text-left transition hover:-translate-y-1 ${
              tool === item.id
                ? "border-[#ccff00]/60 bg-[#ccff00]/8"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
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
              <h2 className="text-2xl font-bold">
                {tool === "merge" ? "Merge your PDFs" : tool === "split" ? "Split your PDF" : "Convert images to PDF"}
              </h2>
              <p className="mt-1 text-sm text-white/40">
                {tool === "merge"
                  ? "Add two or more PDF files."
                  : tool === "split"
                    ? "Add one PDF and choose the pages you want."
                    : "Add one or more JPG or PNG images."}
              </p>
            </div>
            {files.length > 0 && (
              <button onClick={() => setFiles([])} className="text-sm text-white/40 hover:text-white">
                Clear
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />

          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center transition ${
              dragging
                ? "border-[#ccff00] bg-[#ccff00]/10"
                : "border-white/15 bg-black/30 hover:border-[#ccff00]/50"
            }`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ccff00] text-2xl text-black">
              ↑
            </div>
            <strong>Click or drag & drop {tool === "jpg" ? "images" : "PDFs"}</strong>
            <span className="mt-2 text-sm text-white/35">
              Files are processed locally in your browser.
            </span>
          </button>

          {tool === "split" && files.length === 1 && (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-white/70">
                Pages to extract
              </label>
              <input
                value={pageRange}
                onChange={(event) => setPageRange(event.target.value)}
                placeholder="Example: 1,3,5 or 1-3,5"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60"
              />
              <p className="mt-2 text-xs text-white/35">
                Use page numbers, ranges, or both. Example: 1-3,5,8-10
              </p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-5 space-y-2">
              {files.map((file, index) => (
                <div
                  key={file.name + index}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <span className="truncate text-sm">
                    {index + 1}. {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-4 text-xs text-white/40 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={process}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-[#ccff00] px-6 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Processing..."
              : tool === "merge"
                ? "Merge PDF →"
                : tool === "split"
                  ? "Split PDF →"
                  : "Create PDF →"}
          </button>

          {message && (
            <p className="mt-4 text-center text-sm text-[#ccff00]">{message}</p>
          )}
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
