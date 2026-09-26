"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { PDFDocument, degrees, rgb } from "pdf-lib";

type Tool = "merge" | "split" | "jpg" | "images" | "rotate" | "delete" | "reorder" | "compress" | "stamp" | "edit";

const MAX_MERGE_FILES = 100;
const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
const MAX_PDF_PAGES = 300;
const MAX_TOTAL_PAGES = 1000;

const tools = [
  { id: "merge" as Tool, icon: "merge", title: "Merge PDF", text: "Combine up to 100 PDFs into one file." },
  { id: "split" as Tool, icon: "split", title: "Split PDF", text: "Extract a page range into a new PDF." },
  { id: "jpg" as Tool, icon: "image", title: "JPG to PDF", text: "Turn JPG or PNG images into a PDF." },
  { id: "images" as Tool, icon: "file-image", title: "PDF to JPG", text: "Convert PDF pages into JPG images." },
  { id: "rotate" as Tool, icon: "rotate", title: "Rotate PDF", text: "Rotate every page by 90 degrees." },
  { id: "delete" as Tool, icon: "trash", title: "Delete Pages", text: "Remove selected pages from a PDF." },
  { id: "reorder" as Tool, icon: "reorder", title: "Reorder Pages", text: "Change page order using page numbers." },
  { id: "compress" as Tool, icon: "compress", title: "Compress PDF", text: "Optimize the PDF structure in your browser." },
  { id: "stamp" as Tool, icon: "stamp", title: "Stamp & Sign", text: "Add a stamp or signature to every page." },
  { id: "edit" as Tool, icon: "edit", title: "PDF Editor", text: "Preview, select, rotate, delete and reorder pages visually." },
];

function ToolIcon({ type }: { type: string }) {
  const common = "h-7 w-7";
  if (type === "merge") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 7h6l3 3h5"/><path d="M5 17h6l3-3h5"/><path d="M16 6l3 4-3 4"/><path d="M8 13l-3 4 3 4"/></svg>;
  if (type === "split") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 5l8 14"/><path d="M16 5L8 19"/><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>;
  if (type === "image") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 2-2 6 5"/></svg>;
  if (type === "edit") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/></svg>;
  if (type === "file-image") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><circle cx="9" cy="12" r="1.4"/><path d="m7 18 3-3 2 2 2-2 2 3"/></svg>;
  if (type === "rotate") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>;
  if (type === "trash") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg>;
  if (type === "reorder") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 6h3M5 12h3M5 18h3"/><path d="M12 6h7M12 12h7M12 18h7"/><path d="M10 4v16"/></svg>;
  if (type === "compress") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v5H3M16 21v-5h5M21 8h-5V3M3 16h5v5"/><path d="M8 8 3 3M16 16l5 5M16 8l5-5M8 16l-5 5"/></svg>;
  return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18"/><path d="M7 8h10"/><path d="M8 18h8"/><path d="M9 8c0 5-1 7-3 9M15 8c0 5 1 7 3 9"/></svg>;
}

export default function Home() {
  const [tool, setTool] = useState<Tool>("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [message, setMessage] = useState("");
  const [pageRange, setPageRange] = useState("1");
  const [pageOrder, setPageOrder] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [mergeReview, setMergeReview] = useState(false);
  const [editorReview, setEditorReview] = useState(false);
  const [editorOrder, setEditorOrder] = useState<number[]>([]);
  const [editorSelected, setEditorSelected] = useState<number[]>([]);
  const [editorRotations, setEditorRotations] = useState<Record<number, number>>({});
  const [editorThumbnails, setEditorThumbnails] = useState<Record<number, string>>({});
  const [editorLoading, setEditorLoading] = useState<Record<number, boolean>>({});
  const [editorErrors, setEditorErrors] = useState<Record<number, boolean>>({});
  const [editorDragIndex, setEditorDragIndex] = useState<number | null>(null);
  const [pdfThumbnails, setPdfThumbnails] = useState<Record<string, string>>({});
  const [thumbnailLoading, setThumbnailLoading] = useState<Record<string, boolean>>({});
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [overlayType, setOverlayType] = useState<"stamp" | "signature">("stamp");
  const [overlayPosition, setOverlayPosition] = useState("bottom-right");
  const [overlaySize, setOverlaySize] = useState("medium");
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayPages, setOverlayPages] = useState("all");
  const [overlayPageRange, setOverlayPageRange] = useState("1");
  const [stampText, setStampText] = useState("");
  const [stampColor, setStampColor] = useState("#ccff00");
  const [stampThumbnails, setStampThumbnails] = useState<Record<number, string>>({});
  const [stampLoading, setStampLoading] = useState<Record<number, boolean>>({});
  const [stampErrors, setStampErrors] = useState<Record<number, boolean>>({});
  const [stampSelectedPages, setStampSelectedPages] = useState<number[]>([]);
  const [stampTotalPages, setStampTotalPages] = useState(0);
  const [stampAssetPreview, setStampAssetPreview] = useState<string>("");
  const [stampAssetLoading, setStampAssetLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tool !== "merge" || !mergeReview || files.length === 0) {
      setPdfThumbnails({});
      setThumbnailLoading({});
      setThumbnailErrors({});
      return;
    }

    let cancelled = false;

    async function createThumbnails() {
      const next: Record<string, string> = {};
      const loading: Record<string, boolean> = {};

      for (const file of files) {
        const key = getFileKey(file);
        if (pdfThumbnails[key]) continue;

        loading[key] = true;
        if (!cancelled) setThumbnailLoading((current) => ({ ...current, [key]: true }));

        try {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

          // Bundle the PDF.js worker with Next.js instead of relying on a
          // third-party CDN. This avoids CORS/CDN failures on deployed sites.
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();

          const pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
          }).promise;

          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.55 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) continue;

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;

          if (!cancelled) {
            next[key] = canvas.toDataURL("image/jpeg", 0.78);
            setPdfThumbnails((current) => ({ ...current, [key]: next[key] }));
          }

          await pdf.destroy();
        } catch {
          if (!cancelled) {
            setThumbnailErrors((current) => ({ ...current, [key]: true }));
          }
        } finally {
          if (!cancelled) {
            setThumbnailLoading((current) => ({ ...current, [key]: false }));
          }
        }
      }
    }

    void createThumbnails();

    return () => {
      cancelled = true;
    };
  }, [files, tool, mergeReview]);

  useEffect(() => {
    if (tool !== "edit" || !editorReview || files.length !== 1) {
      setEditorThumbnails({});
      setEditorLoading({});
      setEditorErrors({});
      return;
    }

    let cancelled = false;

    async function renderEditorPages() {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
        const count = Math.min(pdf.numPages, MAX_PDF_PAGES);

        if (!cancelled) {
          setEditorOrder(Array.from({ length: count }, (_, index) => index + 1));
          setEditorSelected([]);
        }

        for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
          if (cancelled) break;
          setEditorLoading((current) => ({ ...current, [pageNumber]: true }));

          try {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 0.42 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas unavailable");

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({ canvas, canvasContext: context, viewport }).promise;

            if (!cancelled) {
              setEditorThumbnails((current) => ({
                ...current,
                [pageNumber]: canvas.toDataURL("image/jpeg", 0.82),
              }));
            }
            page.cleanup();
          } catch {
            if (!cancelled) setEditorErrors((current) => ({ ...current, [pageNumber]: true }));
          } finally {
            if (!cancelled) setEditorLoading((current) => ({ ...current, [pageNumber]: false }));
          }
        }

        await pdf.destroy();
      } catch {
        if (!cancelled) setMessage("Could not open this PDF in the visual editor.");
      }
    }

    void renderEditorPages();
    return () => {
      cancelled = true;
    };
  }, [files, tool, editorReview]);



  useEffect(() => {
    if (tool !== "stamp" || files.length !== 1) {
      setStampThumbnails({});
      setStampLoading({});
      setStampErrors({});
      setStampSelectedPages([]);
      setStampTotalPages(0);
      return;
    }

    let cancelled = false;
    async function renderStampPages() {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
        const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
        if (!cancelled) {
          setStampTotalPages(count);
          setStampSelectedPages(Array.from({ length: count }, (_, index) => index + 1));
        }

        for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
          if (cancelled) break;
          setStampLoading((current) => ({ ...current, [pageNumber]: true }));
          try {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 0.55 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas unavailable");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            if (!cancelled) {
              setStampThumbnails((current) => ({
                ...current,
                [pageNumber]: canvas.toDataURL("image/jpeg", 0.8),
              }));
            }
            page.cleanup();
          } catch {
            if (!cancelled) setStampErrors((current) => ({ ...current, [pageNumber]: true }));
          } finally {
            if (!cancelled) setStampLoading((current) => ({ ...current, [pageNumber]: false }));
          }
        }
        await pdf.destroy();
      } catch {
        if (!cancelled) setMessage("Could not preview this PDF.");
      }
    }
    void renderStampPages();
    return () => { cancelled = true; };
  }, [files, tool]);

  useEffect(() => {
    const overlayFile = overlayFile;
    if (!overlayFile) {
      setStampAssetPreview("");
      return;
    }

    let cancelled = false;
    async function previewStampAsset() {
      setStampAssetLoading(true);
      try {
        if (overlayFile.type === "image/png" || overlayFile.type === "image/jpeg" || overlayFile.type === "image/svg+xml") {
          if (!cancelled) setStampAssetPreview(URL.createObjectURL(overlayFile));
          return;
        }

        if (overlayFile.type === "application/pdf" || overlayFile.name.toLowerCase().endsWith(".pdf")) {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
          const pdf = await pdfjsLib.getDocument({ data: await overlayFile.arrayBuffer() }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (!cancelled) setStampAssetPreview(canvas.toDataURL("image/png"));
          await pdf.destroy();
        }
      } catch {
        if (!cancelled) setStampAssetPreview("");
      } finally {
        if (!cancelled) setStampAssetLoading(false);
      }
    }
    void previewStampAsset();
    return () => { cancelled = true; };
  }, [overlayFile]);

  function toggleStampPage(pageNumber: number) {
    setStampSelectedPages((current) =>
      current.includes(pageNumber)
        ? current.filter((page) => page !== pageNumber)
        : [...current, pageNumber].sort((a, b) => a - b)
    );
  }

  function selectAllStampPages() {
    setStampSelectedPages(Array.from({ length: stampTotalPages }, (_, index) => index + 1));
  }

  function clearStampPages() {
    setStampSelectedPages([]);
  }

  async function addFiles(list: FileList | File[]) {
    const selected = Array.from(list);
    const isImageTool = tool === "jpg";
    const candidates = isImageTool
      ? selected.filter((file) => file.type === "image/jpeg" || file.type === "image/png")
      : selected.filter((file) => file.type === "application/pdf");

    if (candidates.length === 0) {
      setMessage(isImageTool ? "Please select JPG or PNG images." : "Please select PDF files.");
      return;
    }

    const valid: File[] = [];
    let rejected = 0;

    for (const file of candidates) {
      const maxSize = isImageTool ? MAX_IMAGE_SIZE : MAX_PDF_SIZE;

      if (file.size === 0 || file.size > maxSize || !(await hasValidFileSignature(file, isImageTool))) {
        rejected++;
        continue;
      }

      valid.push(file);
    }

    if (valid.length === 0) {
      setMessage(
        isImageTool
          ? "No valid JPG/PNG files found. Images must be valid and under 15 MB each."
          : "No valid PDF files found. PDFs must be valid and under 100 MB each."
      );
      return;
    }

    if (tool === "merge") {
      const remaining = MAX_MERGE_FILES - files.length;

      if (remaining <= 0) {
        setMessage("Maximum 100 PDF files can be merged at once.");
        return;
      }

      valid.splice(remaining);
    } else if (valid.length > 1 && tool !== "jpg") {
      valid.splice(1);
    }

    const currentTotal = files.reduce((sum, file) => sum + file.size, 0);
    const accepted: File[] = [];

    for (const file of valid) {
      if (currentTotal + accepted.reduce((sum, item) => sum + item.size, 0) + file.size > MAX_TOTAL_SIZE) break;
      accepted.push(file);
    }

    if (accepted.length === 0) {
      setMessage("Total selected files cannot exceed 250 MB.");
      return;
    }

    const existingKeys = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const uniqueAccepted = accepted.filter(
      (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
    );

    if (uniqueAccepted.length === 0) {
      setMessage("These files are already selected.");
      return;
    }

    setFiles((current) => [...current, ...uniqueAccepted]);
    setMessage(
      rejected > 0 || uniqueAccepted.length < valid.length
        ? `${uniqueAccepted.length} file(s) added. Some files were skipped or already selected.`
        : ""
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
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
    setProgress(0);
    setProgressLabel("Preparing PDFs...");
    try {
      const merged = await PDFDocument.create();
      let totalPages = 0;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgressLabel(`Reading ${index + 1} of ${files.length}: ${file.name}`);
        const source = await PDFDocument.load(await file.arrayBuffer());
        totalPages += source.getPageCount();

        if (totalPages > MAX_TOTAL_PAGES) {
          setMessage(`This merge contains more than ${MAX_TOTAL_PAGES} pages. Please merge fewer pages at once.`);
          return;
        }

        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        setProgress(Math.round(((index + 1) / files.length) * 90));
      }

      setProgressLabel("Creating final PDF...");
      const bytes = await merged.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-merged.pdf");
      setMessage(`Merged ${files.length} PDFs • ${totalPages} pages successfully.`);
    } catch {
      setMessage("Could not process one of the PDFs.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function splitPdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF for Split PDF.");
      return;
    }

    setBusy(true);
    setProgress(10);
    setProgressLabel("Loading PDF...");
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
      setProgress(70);
      setProgressLabel("Building selected pages...");
      const copied = await output.copyPages(source, pageNumbers.map((page) => page - 1));
      copied.forEach((page) => output.addPage(page));
      setProgressLabel("Creating download...");
      const bytes = await output.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-split.pdf");
      setMessage("Selected pages downloaded successfully.");
    } catch {
      setMessage("Could not split the PDF.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function imagesToPdf() {
    if (files.length === 0) {
      setMessage("Select at least 1 JPG or PNG image.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressLabel("Preparing images...");
    try {
      const pdf = await PDFDocument.create();

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgressLabel(`Adding image ${index + 1} of ${files.length}`);
        if (file.size > MAX_IMAGE_SIZE) {
          setMessage("Each image must be under 15 MB.");
          return;
        }
        const bytes = await file.arrayBuffer();
        const image = file.type === "image/png"
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);

        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        setProgress(Math.round(((index + 1) / files.length) * 90));
      }

      setProgressLabel("Creating PDF...");
      const bytes = await pdf.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-images.pdf");
      setMessage("PDF created from images successfully.");
    } catch {
      setMessage("Could not convert the selected images.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function pdfToJpg() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF for PDF to JPG.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressLabel("Loading PDF renderer...");
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
      if (pdf.numPages > MAX_PDF_PAGES) {
        setMessage(`This PDF has ${pdf.numPages} pages. Maximum supported is ${MAX_PDF_PAGES} pages for PDF to JPG.`);
        return;
      }

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setProgressLabel(`Converting page ${pageNumber} of ${pdf.numPages}`);
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
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setProgress(Math.round((pageNumber / pdf.numPages) * 100));
      }

      setMessage(`Converted ${pdf.numPages} page(s) to JPG.`);
    } catch {
      setMessage("Could not convert the PDF to JPG.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function rotatePdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    setProgress(15);
    setProgressLabel("Loading PDF...");
    try {
      const pdf = await PDFDocument.load(await files[0].arrayBuffer());

      const pages = pdf.getPages();
      pages.forEach((page, index) => {
        page.setRotation(degrees((page.getRotation().angle + 90) % 360));
        if (index % 10 === 0) setProgress(15 + Math.round((index / pages.length) * 65));
      });

      setProgressLabel("Creating rotated PDF...");
      const bytes = await pdf.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-rotated.pdf");
      setMessage("PDF rotated successfully.");
    } catch {
      setMessage("Could not rotate the PDF.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function deletePages() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    setProgress(10);
    setProgressLabel("Loading PDF...");
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

      setProgressLabel("Rebuilding PDF...");
      const copied = await output.copyPages(source, keepIndexes);
      copied.forEach((page) => output.addPage(page));

      const bytes = await output.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-pages-deleted.pdf");
      setMessage("Selected pages deleted successfully.");
    } catch {
      setMessage("Could not delete pages.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function reorderPages() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    setProgress(10);
    setProgressLabel("Loading PDF...");
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
      setProgressLabel("Reordering pages...");
      const copied = await output.copyPages(source, order.map((page) => page - 1));
      copied.forEach((page) => output.addPage(page));

      const bytes = await output.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-reordered.pdf");
      setMessage("PDF pages reordered successfully.");
    } catch {
      setMessage("Could not reorder the PDF.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function stampPdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    if (overlayType === "stamp" && !overlayFile && !stampText.trim()) {
      setMessage("Upload a stamp image or enter stamp text.");
      return;
    }

    if (overlayType === "signature" && !overlayFile) {
      setMessage("Upload your signature file first.");
      return;
    }

    if (overlayFile && stampSelectedPages.length === 0) {
      setMessage("Select at least one PDF page for the stamp/signature.");
      return;
    }

    setBusy(true);
    setProgress(10);
    setProgressLabel("Loading PDF...");
    try {
      const pdf = await PDFDocument.load(await files[0].arrayBuffer());
      const totalPages = pdf.getPageCount();
      if (totalPages > MAX_PDF_PAGES) {
        setMessage(`This PDF has ${totalPages} pages. Maximum supported is ${MAX_PDF_PAGES} pages per operation.`);
        return;
      }
      let image = null;

      if (overlayFile) {
        const fileName = overlayFile.name.toLowerCase();

        if (overlayFile.type === "image/png") {
          image = await pdf.embedPng(await overlayFile.arrayBuffer());
        } else if (overlayFile.type === "image/jpeg" || overlayFile.type === "image/jpg") {
          image = await pdf.embedJpg(await overlayFile.arrayBuffer());
        } else if (
          overlayFile.type === "image/svg+xml" ||
          fileName.endsWith(".svg") ||
          overlayFile.type === "application/pdf" ||
          fileName.endsWith(".pdf")
        ) {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();

          const assetPdf = overlayFile.type === "application/pdf" || fileName.endsWith(".pdf")
            ? await pdfjsLib.getDocument({ data: await overlayFile.arrayBuffer() }).promise
            : null;

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");

          if (assetPdf) {
            const page = await assetPdf.getPage(1);
            const viewport = page.getViewport({ scale: 2 });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            await assetPdf.destroy();
          } else {
            const url = URL.createObjectURL(overlayFile);
            const imageElement = new Image();
            await new Promise<void>((resolve, reject) => {
              imageElement.onload = () => resolve();
              imageElement.onerror = () => reject(new Error("Could not read SVG"));
              imageElement.src = url;
            });
            canvas.width = imageElement.naturalWidth || 1200;
            canvas.height = imageElement.naturalHeight || 1200;
            context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
          }

          image = await pdf.embedPng(canvas.toDataURL("image/png"));
        }
      }

      const selectedPages = stampSelectedPages.filter(
        (page) => page >= 1 && page <= totalPages
      );

      const sizeRatio = overlaySize === "small" ? 0.16 : overlaySize === "large" ? 0.32 : 0.24;
      const opacity = overlayOpacity / 100;
      const rotation = degrees(overlayRotation);

      for (let index = 0; index < selectedPages.length; index++) {
        const pageNumber = selectedPages[index];
        setProgressLabel(`Applying overlay ${index + 1} of ${selectedPages.length}`);
        const page = pdf.getPage(pageNumber - 1);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const margin = Math.max(18, Math.min(pageWidth, pageHeight) * 0.04);

        if (image) {
          const ratio = Math.min(
            (pageWidth * sizeRatio) / image.width,
            (pageHeight * sizeRatio) / image.height
          );
          const width = image.width * ratio;
          const height = image.height * ratio;

          let x = margin;
          let y = margin;

          if (overlayPosition.includes("right")) x = pageWidth - width - margin;
          if (overlayPosition.includes("center")) x = (pageWidth - width) / 2;
          if (overlayPosition.includes("middle")) y = (pageHeight - height) / 2;
          if (overlayPosition.includes("top")) y = pageHeight - height - margin;

          page.drawImage(image, {
            x,
            y,
            width,
            height,
            opacity,
            rotate: rotation,
          });
        }

        if (overlayType === "stamp" && stampText.trim()) {
          const fontSize = overlaySize === "small" ? 18 : overlaySize === "large" ? 34 : 26;
          const textWidth = stampText.trim().length * fontSize * 0.55;
          let x = margin;
          let y = margin;

          if (overlayPosition.includes("right")) x = pageWidth - textWidth - margin;
          if (overlayPosition.includes("center")) x = (pageWidth - textWidth) / 2;
          if (overlayPosition.includes("middle")) y = (pageHeight - fontSize) / 2;
          if (overlayPosition.includes("top")) y = pageHeight - fontSize - margin;

          page.drawText(stampText.trim(), {
            x: Math.max(margin, x),
            y: Math.max(margin, y),
            size: fontSize,
            opacity,
            rotate: rotation,
            color: hexToRgb(stampColor),
          });
        }

        setProgress(10 + Math.round(((index + 1) / selectedPages.length) * 80));
      }

      setProgressLabel("Creating final PDF...");
      const bytes = await pdf.save({ useObjectStreams: true });
      setProgress(100);
      download(
        bytes,
        overlayType === "stamp" ? "pdfera-stamped.pdf" : "pdfera-signed.pdf"
      );

      setMessage(
        overlayPages === "all"
          ? `${overlayType === "stamp" ? "Stamp" : "Signature"} applied to all ${totalPages} pages.`
          : `${overlayType === "stamp" ? "Stamp" : "Signature"} applied to ${selectedPages.length} selected page(s).`
      );
    } catch {
      setMessage("Could not add the stamp or signature.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  async function compressPdf() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF.");
      return;
    }

    setBusy(true);
    setProgress(10);
    setProgressLabel("Analyzing PDF structure...");
    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      const before = files[0].size;
      setProgress(45);
      setProgressLabel("Optimizing PDF...");
      const bytes = await source.save({ useObjectStreams: true });
      download(bytes, "pdfera-compressed.pdf");

      const after = bytes.byteLength;
      setProgress(100);
      const percent = before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
      setMessage(`Optimized PDF downloaded. Size change: ${percent}% smaller.`);
    } catch {
      setMessage("Could not optimize the PDF.");
    } finally {
      setBusy(false);
      setProgressLabel("");
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
    else if (tool === "stamp") await stampPdf();
    else await compressPdf();
  }

  function selectTool(nextTool: Tool) {
    setTool(nextTool);
    setFiles([]);
    setProgress(0);
    setProgressLabel("");
    setMessage("");
    setPageRange("1");
    setPageOrder("");
    setMergeReview(false);
    setEditorReview(false);
    setEditorOrder([]);
    setEditorSelected([]);
    setEditorRotations({});
    setEditorThumbnails({});
    setEditorLoading({});
    setEditorErrors({});
    setEditorDragIndex(null);
    setOverlayFile(null);
    setOverlayType("stamp");
    setOverlayPosition("bottom-right");
    setOverlaySize("medium");
    setOverlayOpacity(100);
    setOverlayRotation(0);
    setOverlayPages("all");
    setOverlayPageRange("1");
    setStampText("");
    setStampColor("#ccff00");
    setStampThumbnails({});
    setStampLoading({});
    setStampErrors({});
    setStampSelectedPages([]);
    setStampTotalPages(0);
    setStampAssetPreview("");
    setStampAssetLoading(false);
  }

  function openEditorReview() {
    if (files.length !== 1) {
      setMessage("Select exactly 1 PDF for the PDF Editor.");
      return;
    }

    setMessage("");
    setEditorReview(true);
  }

  function toggleEditorPage(pageNumber: number) {
    setEditorSelected((current) =>
      current.includes(pageNumber)
        ? current.filter((page) => page !== pageNumber)
        : [...current, pageNumber]
    );
  }

  function rotateEditorPages() {
    if (editorSelected.length === 0) {
      setMessage("Select at least one page to rotate.");
      return;
    }

    setEditorRotations((current) => {
      const next = { ...current };
      for (const page of editorSelected) {
        next[page] = ((next[page] || 0) + 90) % 360;
      }
      return next;
    });
  }

  function deleteEditorPages() {
    if (editorSelected.length === 0) {
      setMessage("Select at least one page to delete.");
      return;
    }

    if (editorSelected.length >= editorOrder.length) {
      setMessage("Keep at least one page in the PDF.");
      return;
    }

    setEditorOrder((current) => current.filter((page) => !editorSelected.includes(page)));
    setEditorSelected([]);
    setMessage("");
  }

  function moveEditorPage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= editorOrder.length) return;

    setEditorOrder((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function exportEditedPdf() {
    if (files.length !== 1 || editorOrder.length === 0) {
      setMessage("Open a PDF in the editor first.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setProgressLabel("Building edited PDF...");

    try {
      const source = await PDFDocument.load(await files[0].arrayBuffer());
      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, editorOrder.map((page) => page - 1));

      for (let index = 0; index < copied.length; index++) {
        const originalPage = editorOrder[index];
        const page = copied[index];
        const rotation = editorRotations[originalPage] || 0;
        page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
        output.addPage(page);
        setProgress(Math.round(((index + 1) / copied.length) * 90));
      }

      setProgressLabel("Creating final PDF...");
      const bytes = await output.save({ useObjectStreams: true });
      setProgress(100);
      download(bytes, "pdfera-edited.pdf");
      setMessage("Edited PDF downloaded successfully.");
    } catch {
      setMessage("Could not create the edited PDF.");
    } finally {
      setBusy(false);
      setProgressLabel("");
    }
  }

  function openMergeReview() {
    if (files.length < 2) {
      setMessage("Select at least 2 PDF files.");
      return;
    }

    setMessage("");
    setMergeReview(true);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const needsPdf = tool !== "jpg";
  const accept = needsPdf ? "application/pdf" : "image/jpeg,image/png";
  const multiple = tool === "merge" || tool === "jpg";

  if (tool === "edit" && editorReview) {
    return (
      <main className="min-h-screen overflow-x-hidden">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div className="shrink-0 text-xl font-black tracking-tight sm:text-2xl">PDF<span className="text-[#ccff00]">era</span></div>
          <span className="hidden rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 sm:inline-flex">PDF Editor</span>
        </nav>

        <section className="mx-auto max-w-7xl px-6 pb-24 pt-8">
          <button onClick={() => setEditorReview(false)} className="mb-6 cursor-pointer text-sm text-white/45 transition hover:text-white">
            ← Back to upload
          </button>

          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-[#ccff00]">Visual PDF Editor</p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Edit your PDF visually</h1>
              <p className="mt-3 text-white/45">Select pages, drag to reorder, rotate pages, or remove pages before exporting.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              <span className="font-bold">{editorOrder.length}</span>
              <span className="ml-1 text-white/40">pages</span>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
            <button type="button" onClick={() => setEditorSelected(editorOrder)} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Select all</button>
            <button type="button" onClick={() => setEditorSelected([])} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Clear selection</button>
            <button type="button" onClick={rotateEditorPages} disabled={editorSelected.length === 0} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35 hover:bg-white/5">↻ Rotate selected</button>
            <button type="button" onClick={deleteEditorPages} disabled={editorSelected.length === 0} className="cursor-pointer rounded-xl border border-red-400/20 px-4 py-2 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-35 hover:bg-red-400/10">Delete selected</button>
            <span className="ml-auto text-xs text-white/35">{editorSelected.length} selected</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {editorOrder.map((pageNumber, index) => (
              <div
                key={pageNumber}
                draggable
                onDragStart={() => setEditorDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (editorDragIndex !== null) moveEditorPage(editorDragIndex, index);
                  setEditorDragIndex(null);
                }}
                onDragEnd={() => setEditorDragIndex(null)}
                className={`group relative rounded-3xl border p-3 transition cursor-grab active:cursor-grabbing ${
                  editorSelected.includes(pageNumber)
                    ? "border-[#ccff00]/70 bg-[#ccff00]/8 shadow-[0_0_0_2px_rgba(204,255,0,0.08)]"