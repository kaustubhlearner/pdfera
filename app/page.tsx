"use client";

import { DragEvent, useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";

type Tool = "merge" | "split" | "jpg" | "images" | "rotate" | "delete" | "reorder" | "compress";

const MAX_MERGE_FILES = 100;

const tools = [
  { id: "merge" as Tool, icon: "↔", title: "Merge PDF", text: "Combine up to 100 PDFs into one file." },
  { id: "split" as Tool, icon: "✂", title: "Split PDF", text: "Extract a page range into a new PDF." },
  { id: "jpg" as Tool, icon: "▣", title: "JPG to PDF", text: "Turn JPG or PNG images into a PDF." },
  { id: "images" as Tool, icon: "▤", title: "PDF to JPG", text: "Convert PDF pages into JPG images." },
  { id: "rotate" as Tool, icon: "↻", title: "Rotate PDF", text: "Rotate every page by 90 degrees." },
  { id: "delete" as Tool, icon: "⌫", title: "Delete Pages", text: "Remove selected pages from a PDF." },
  { id: "reorder" as Tool, icon: "☷", title: "Reorder Pages", text: "Change page order using page numbers." },
  { id: "compress" as Tool, icon: "↓", title: "Compress PDF", text: "Optimize the PDF structure in your browser." },
];

export default function Home() {
  const [tool, setTool] = useState<Tool>("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pageRange, setPageRange] = useState("1");
  const [pageOrder, setPageOrder] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
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

    if (tool === "merge") {
      const remaining = MAX_MERGE_FILES - files.length;

      if (remaining <= 0) {
        setMessage("Maximum 100 PDF files can be merged at once.");
        return;
      }

      if (allowed.length > remaining) {
        setFiles((current) => [...current, ...allowed.slice(0, remaining)]);
        setMessage(`Maximum limit is 100 PDFs. Only the first ${remaining} selected file(s) were added.`);
        return;
      }
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

  function moveFile(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= files.length) return;

    setFiles((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleFileDragStart(index: number) {
    setDragIndex(index);
  }

  function handleFileDrop(index: number) {
    if (dragIndex !== null) moveFile(dragIndex, index);
    setDragIndex(null);
  }

  async function mergePdfs() {
    if (files.length < 2) {
      setMessage("Select at least 2 PDF files.");
      return;
    }

    if (files.length > MAX_MERGE_FILES) {
      setMessage("Maximum 100 PDF files can be merged at once.");
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
      setMessage(`Merged ${files.length} PDFs successfully.`);
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
      const totalPages = source.getPageCount();
      const parts = pageRange.split(",").map((part) => part.trim()).filter(Boolean);
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
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }

      download(await pdf.save(), "pdfera-images.pdf");
      setMessage("PDF created from images successfully.");
    } catch {
      setMessage("Could not convert the selected images.");
    } finally {
      setBusy(false);
    }
  }

  async function pdfToJpg() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF for PDF to JPG.");
      return;
    }

    setBusy(true);
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Canvas is not supported.");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.9)
        );

        if (!blob) throw new Error("Could not create image.");

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `pdfera-page-${pageNumber}.jpg`;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      setMessage(`Converted ${pdf.numPages} page(s) to JPG.`);
    } catch {
      setMessage("Could not convert the PDF to JPG.");
    } finally {
      setBusy(false);
    }
  }

  async function rotatePdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    try {
      const pdf = await PDFDocument.load(await files[0].arrayBuffer());

      pdf.getPages().forEach((page) => {
        page.setRotation(degrees((page.getRotation().angle + 90) % 360));
      });

      download(await pdf.save(), "pdfera-rotated.pdf");
      setMessage("PDF rotated successfully.");
    } catch {
      setMessage("Could not rotate the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePages() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      const totalPages = source.getPageCount();
      const deleteNumbers = parsePageNumbers(pageRange, totalPages);

      if (deleteNumbers.length === 0) {
        setMessage("Enter pages to delete, for example 2,4 or 2-5.");
        return;
      }

      if (deleteNumbers.length >= totalPages) {
        setMessage("At least one page must remain in the PDF.");
        return;
      }

      const output = await PDFDocument.create();
      const keepIndexes: number[] = [];

      for (let page = 1; page <= totalPages; page++) {
        if (!deleteNumbers.includes(page)) keepIndexes.push(page - 1);
      }

      const copied = await output.copyPages(source, keepIndexes);
      copied.forEach((page) => output.addPage(page));

      download(await output.save(), "pdfera-pages-deleted.pdf");
      setMessage("Selected pages deleted successfully.");
    } catch {
      setMessage("Could not delete pages.");
    } finally {
      setBusy(false);
    }
  }

  async function reorderPages() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      const totalPages = source.getPageCount();
      const order = pageOrder.split(",").map((part) => Number(part.trim())).filter((page) => Number.isInteger(page));

      if (order.length !== totalPages) {
        setMessage(`Enter all ${totalPages} page numbers exactly once. Example: 3,1,2`);
        return;
      }

      const unique = new Set(order);
      if (unique.size !== totalPages || order.some((page) => page < 1 || page > totalPages)) {
        setMessage("Page order must contain every page exactly once.");
        return;
      }

      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, order.map((page) => page - 1));
      copied.forEach((page) => output.addPage(page));

      download(await output.save(), "pdfera-reordered.pdf");
      setMessage("PDF pages reordered successfully.");
    } catch {
      setMessage("Could not reorder the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function compressPdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      const before = files[0].size;
      const bytes = await source.save({ useObjectStreams: true });
      download(bytes, "pdfera-compressed.pdf");

      const after = bytes.byteLength;
      const percent = before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
      setMessage(`Optimized PDF downloaded. Size change: ${percent}% smaller.`);
    } catch {
      setMessage("Could not optimize the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function process() {
    if (tool === "merge") await mergePdfs();
    else if (tool === "split") await splitPdf();
    else if (tool === "jpg") await imagesToPdf();
    else if (tool === "images") await pdfToJpg();
    else if (tool === "rotate") await rotatePdf();
    else if (tool === "delete") await deletePages();
    else if (tool === "reorder") await reorderPages();
    else await compressPdf();
  }

  function selectTool(nextTool: Tool) {
    setTool(nextTool);
    setFiles([]);
    setMessage("");
    setPageRange("1");
    setPageOrder("");
  }

  const needsPdf = tool !== "jpg";
  const accept = needsPdf ? "application/pdf" : "image/jpeg,image/png";
  const multiple = tool === "merge" || tool === "jpg";

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
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.25em] text-[#ccff00]">PDF tools, made simple</p>
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
          Work with PDFs.
          <br />
          <span className="text-white/35">No complicated setup.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
          Merge, split, convert, rotate and organize files directly in your browser.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-10 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTool(item.id)}
            className={`rounded-3xl border p-6 text-left transition hover:-translate-y-1 ${
              tool === item.id ? "border-[#ccff00]/60 bg-[#ccff00]/8" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="mb-7 text-3xl">{item.icon}</div>
            <h2 className="text-lg font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-white/45">{item.text}</p>
          </button>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 sm:p-10">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {tool === "merge" ? "Merge your PDFs" :
                 tool === "split" ? "Split your PDF" :
                 tool === "jpg" ? "Convert images to PDF" :
                 tool === "images" ? "Convert PDF to JPG" :
                 tool === "rotate" ? "Rotate your PDF" :
                 tool === "delete" ? "Delete PDF pages" :
                 tool === "reorder" ? "Reorder PDF pages" : "Optimize your PDF"}
              </h2>
              <p className="mt-1 text-sm text-white/40">
                {tool === "merge" ? `Add 2 to ${MAX_MERGE_FILES} PDF files.` :
                 tool === "split" ? "Add one PDF and choose the pages you want." :
                 tool === "jpg" ? "Add one or more JPG or PNG images." :
                 tool === "images" ? "Add one PDF. Each page becomes a JPG." :
                 tool === "rotate" ? "Rotate every page by 90 degrees clockwise." :
                 tool === "delete" ? "Choose pages to remove." :
                 tool === "reorder" ? "Enter the complete new page order." :
                 "Re-save the PDF with object streams enabled."}
              </p>
            </div>
            {files.length > 0 && (
              <button onClick={() => setFiles([])} className="text-sm text-white/40 hover:text-white">Clear</button>
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
              dragging ? "border-[#ccff00] bg-[#ccff00]/10" : "border-white/15 bg-black/30 hover:border-[#ccff00]/50"
            }`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ccff00] text-2xl text-black">↑</div>
            <strong>Click or drag & drop {tool === "jpg" ? "images" : "PDFs"}</strong>
            <span className="mt-2 text-sm text-white/35">Files are processed locally in your browser.</span>
          </button>

          {(tool === "split" || tool === "delete") && files.length === 1 && (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-white/70">
                {tool === "delete" ? "Pages to delete" : "Pages to extract"}
              </label>
              <input
                value={pageRange}
                onChange={(event) => setPageRange(event.target.value)}
                placeholder="Example: 1,3,5 or 1-3,5"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60"
              />
              <p className="mt-2 text-xs text-white/35">Use page numbers, ranges, or both.</p>
            </div>
          )}

          {tool === "reorder" && files.length === 1 && (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-white/70">New page order</label>
              <input
                value={pageOrder}
                onChange={(event) => setPageOrder(event.target.value)}
                placeholder="Example: 3,1,2,4"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60"
              />
              <p className="mt-2 text-xs text-white/35">Use every page number exactly once.</p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-5">
              {tool === "merge" && (
                <div className="mb-3 rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/5 px-4 py-3 text-sm text-white/65">
                  <span className="font-semibold text-[#ccff00]">Customize order:</span> Drag the PDFs up or down. The first PDF will be at the front and the last PDF will be at the end.
                </div>
              )}

              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={file.name + index}
                    draggable={tool === "merge"}
                    onDragStart={() => handleFileDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleFileDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      dragIndex === index
                        ? "border-[#ccff00] bg-[#ccff00]/10"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    {tool === "merge" && (
                      <span className="cursor-grab select-none text-lg text-white/35" title="Drag to reorder">☷</span>
                    )}

                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white/60">
                      {index + 1}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>

                    {tool === "merge" && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => moveFile(index, index - 1)}
                          disabled={index === 0}
                          className="rounded-lg px-2 py-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveFile(index, index + 1)}
                          disabled={index === files.length - 1}
                          className="rounded-lg px-2 py-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => removeFile(index)}
                      className="shrink-0 text-xs text-white/40 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={process}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-[#ccff00] px-6 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing..." :
             tool === "merge" ? "Merge PDF →" :
             tool === "split" ? "Split PDF →" :
             tool === "jpg" ? "Create PDF →" :
             tool === "images" ? "Convert to JPG →" :
             tool === "rotate" ? "Rotate PDF →" :
             tool === "delete" ? "Delete Pages →" :
             tool === "reorder" ? "Reorder PDF →" : "Optimize PDF →"}
          </button>

          {message && <p className="mt-4 text-center text-sm text-[#ccff00]">{message}</p>}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/30">
        PDFera • Built as a free-first PDF toolkit • Merge limit: 100 PDFs
      </footer>
    </main>
  );
}

function parsePageNumbers(value: string, totalPages: number) {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const pageNumbers: number[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const range = part.split("-");
      const start = Number(range[0]);
      const end = Number(range[1]);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > totalPages || start > end) {
        return [];
      }

      for (let page = start; page <= end; page++) {
        if (!pageNumbers.includes(page)) pageNumbers.push(page);
      }
    } else {
      const page = Number(part);

      if (!Number.isInteger(page) || page < 1 || page > totalPages) return [];
      if (!pageNumbers.includes(page)) pageNumbers.push(page);
    }
  }

  return pageNumbers;
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
