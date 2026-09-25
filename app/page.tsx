"use client";

import { DragEvent, useRef, useState } from "react";
import { PDFDocument, degrees, rgb } from "pdf-lib";

type Tool = "merge" | "split" | "jpg" | "images" | "rotate" | "delete" | "reorder" | "compress" | "stamp";

const MAX_MERGE_FILES = 100;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
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
];

function ToolIcon({ type }: { type: string }) {
  const common = "h-7 w-7";
  if (type === "merge") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 7h6l3 3h5"/><path d="M5 17h6l3-3h5"/><path d="M16 6l3 4-3 4"/><path d="M8 13l-3 4 3 4"/></svg>;
  if (type === "split") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 5l8 14"/><path d="M16 5L8 19"/><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>;
  if (type === "image") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 2-2 6 5"/></svg>;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

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
          : "No valid PDF files found. PDFs must be valid and under 50 MB each."
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
      setMessage("Upload your signature image first.");
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
        const imageBytes = await overlayFile.arrayBuffer();
        image = overlayFile.type === "image/png"
          ? await pdf.embedPng(imageBytes)
          : await pdf.embedJpg(imageBytes);
      }

      let selectedPages: number[] = [];

      if (overlayPages === "all") {
        for (let page = 1; page <= totalPages; page++) selectedPages.push(page);
      } else {
        selectedPages = parsePageNumbers(overlayPageRange, totalPages);
        if (selectedPages.length === 0) {
          setMessage("Enter valid pages, for example 1,3,5 or 1-3.");
          return;
        }
      }

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

  if (tool === "merge" && mergeReview) {
    return (
      <main className="min-h-screen">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div className="text-2xl font-black tracking-tight">
            PDF<span className="text-[#ccff00]">era</span>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">
            Merge PDF
          </span>
        </nav>

        <section className="mx-auto max-w-7xl px-6 pb-24 pt-8">
          <button
            onClick={() => setMergeReview(false)}
            className="mb-8 text-sm text-white/45 transition hover:text-white"
          >
            ← Back to upload
          </button>

          <div className="mb-8">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#ccff00]">Step 2 of 2</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Arrange your PDFs</h1>
            <p className="mt-3 text-white/45">
              Drag the files into the order you want. The first file will be first in the merged PDF.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <div>
              <span className="font-bold">{files.length} PDFs selected</span>
              <span className="ml-2 text-sm text-white/35">Maximum {MAX_MERGE_FILES}</span>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold transition hover:border-[#ccff00]/50 hover:text-[#ccff00]"
            >
              + Add more PDFs
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file, index) => (
              <div
                key={file.name + index}
                draggable
                onDragStart={() => handleFileDragStart(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleFileDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={`group relative cursor-grab rounded-2xl border bg-[#11151b] p-4 transition hover:-translate-y-1 hover:border-white/25 ${
                  dragIndex === index
                    ? "border-[#ccff00] bg-[#ccff00]/10"
                    : "border-white/10"
                }`}
              >
                <div className="relative flex h-44 items-center justify-center rounded-xl bg-white/[0.035]">
                  <div className="flex h-20 w-16 flex-col items-center justify-center rounded-lg border border-white/10 bg-[#181d24] shadow-xl">
                    <span className="text-2xl font-black text-[#ccff00]">PDF</span>
                    <span className="mt-1 text-[9px] uppercase tracking-widest text-white/30">Document</span>
                  </div>
                  <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#ccff00] text-sm font-black text-black">
                    {index + 1}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-white/50 opacity-0 transition group-hover:opacity-100 hover:text-white"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 min-w-0">
                  <p className="truncate font-semibold" title={file.name}>{file.name}</p>
                  <p className="mt-1 text-xs text-white/35">{formatFileSize(file.size)} • Drag to move</p>
                </div>
              </div>
            ))}
          </div>

          {message && <p className="mt-5 text-center text-sm text-[#ccff00]">{message}</p>}

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => setMergeReview(false)}
              className="rounded-2xl border border-white/10 px-7 py-4 font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Back
            </button>
            <button
              onClick={mergePdfs}
              disabled={busy || files.length < 2}
              className="rounded-2xl bg-[#ccff00] px-8 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Merging PDFs..." : `Merge ${files.length} PDFs →`}
            </button>
          </div>
        </section>
      </main>
    );
  }

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
            className={`group rounded-3xl border p-6 text-left transition hover:-translate-y-1 ${
              tool === item.id ? "border-[#ccff00]/60 bg-[#ccff00]/8" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="mb-7 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/85 transition group-hover:border-[#ccff00]/30 group-hover:bg-[#ccff00]/10 group-hover:text-[#ccff00]"><ToolIcon type={item.icon} /></div>
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
                 tool === "reorder" ? "Reorder PDF pages" :
                 tool === "stamp" ? "Stamp or sign every page" : "Optimize your PDF"}
              </h2>
              <p className="mt-1 text-sm text-white/40">
                {tool === "merge" ? `Add 2 to ${MAX_MERGE_FILES} PDF files.` :
                 tool === "split" ? "Add one PDF and choose the pages you want." :
                 tool === "jpg" ? "Add one or more JPG or PNG images." :
                 tool === "images" ? "Add one PDF. Each page becomes a JPG." :
                 tool === "rotate" ? "Rotate every page by 90 degrees clockwise." :
                 tool === "delete" ? "Choose pages to remove." :
                 tool === "reorder" ? "Enter the complete new page order." :
                 tool === "stamp" ? "Upload a stamp or signature image and apply it to every page." :
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

          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`relative cursor-pointer overflow-hidden rounded-3xl border border-dashed px-6 py-9 text-center transition duration-200 hover:-translate-y-0.5 ${dragging
                ? "border-[#ccff00] bg-[#ccff00]/10 shadow-[0_0_0_4px_rgba(204,255,0,0.06)]"
                : "border-white/15 bg-black/30 hover:border-[#ccff00]/40"}`}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/10 text-[#ccff00]">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-bold">{dragging ? "Drop your files here" : "Upload your files"}</h3>
              <p className="mt-2 text-sm text-white/45">Drag & drop here, or choose files from your device</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-6 cursor-pointer rounded-xl bg-[#ccff00] px-6 py-3 text-sm font-black text-black transition hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0">
                Choose {tool === "jpg" ? "Images" : "PDF Files"}
              </button>
              <div className="mx-auto mt-5 max-w-xl border-t border-white/10 pt-4 text-xs text-white/35">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <span>{tool === "jpg" ? "JPG / PNG" : "PDF only"}</span><span>•</span>
                  <span>Max {tool === "jpg" ? "15 MB per image" : "50 MB per PDF"}</span><span>•</span>
                  <span>Private & processed in your browser</span>
                </div>
                {tool === "merge" && <p className="mt-2">Up to {MAX_MERGE_FILES} PDF files</p>}
              </div>
            </div>

            {files.length > 0 && (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/25">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="font-bold">Selected files</p>
                    <p className="mt-1 text-xs text-white/35">{files.length} file{files.length === 1 ? "" : "s"} • {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}</p>
                  </div>
                  <button type="button" onClick={() => setFiles([])} className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition hover:border-white/20 hover:bg-white/5 hover:text-white">Clear all</button>
                </div>

                <div className="max-h-80 overflow-y-auto p-3">
                  {files.map((file, index) => (
                    <div
                      key={file.name + index}
                      draggable={tool === "merge"}
                      onDragStart={() => handleFileDragStart(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleFileDrop(index)}
                      onDragEnd={() => setDragIndex(null)}
                      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${tool === "merge" ? "cursor-grab active:cursor-grabbing" : ""} ${dragIndex === index ? "border-[#ccff00]/50 bg-[#ccff00]/5" : "border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xs font-black text-[#ccff00]">
                        {tool === "jpg" ? "IMG" : "PDF"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
                        <p className="mt-1 text-xs text-white/35">{formatFileSize(file.size)} {tool === "merge" && "• Drag to reorder"}</p>
                      </div>
                      <span className="hidden rounded-full border border-[#ccff00]/15 bg-[#ccff00]/5 px-2 py-1 text-[10px] font-bold text-[#ccff00] sm:inline-flex">READY</span>
                      <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`} className="cursor-pointer rounded-lg px-2 py-2 text-xs text-white/30 transition hover:bg-white/5 hover:text-white">Remove</button>
                    </div>
                  ))}
                </div>

                {tool === "merge" && files.length < MAX_MERGE_FILES && (
                  <div className="border-t border-white/10 p-3">
                    <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm font-semibold text-white/50 transition hover:border-[#ccff00]/40 hover:text-[#ccff00]">
                      <span className="text-lg">+</span> Add more PDFs
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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

          {tool === "stamp" && files.length === 1 && (
            <div className="mt-5 space-y-5 rounded-3xl border border-white/10 bg-black/30 p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">What do you want to add?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOverlayType("stamp")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${overlayType === "stamp" ? "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]" : "border-white/10 text-white/50"}`}>Stamp</button>
                  <button onClick={() => setOverlayType("signature")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${overlayType === "signature" ? "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]" : "border-white/10 text-white/50"}`}>Signature</button>
                </div>
              </div>

              {overlayType === "stamp" && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">Stamp text (optional)</label>
                  <input
                    value={stampText}
                    onChange={(event) => setStampText(event.target.value)}
                    placeholder="Example: APPROVED, PAID, CONFIDENTIAL"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs text-white/40">Text color</label>
                    <input type="color" value={stampColor} onChange={(event) => setStampColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded-lg bg-transparent" />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  {overlayType === "stamp" ? "Stamp image (optional)" : "Signature image"}
                </label>
                <input ref={overlayInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (event) => {
                    const file = event.target.files?.[0] || null;
                    event.currentTarget.value = "";
                    if (!file) return;
                    if (file.size > MAX_IMAGE_SIZE || !(await hasValidFileSignature(file, true))) {
                      setOverlayFile(null);
                      setMessage("Stamp/signature image must be a valid JPG or PNG under 15 MB.");
                      return;
                    }
                    setOverlayFile(file);
                    setMessage("");
                  }} />
                <button onClick={() => overlayInputRef.current?.click()} className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-4 text-left transition hover:border-[#ccff00]/50">
                  <span className="block font-semibold">{overlayFile ? overlayFile.name : `Choose ${overlayType} image`}</span>
                  <span className="mt-1 block text-xs text-white/35">PNG with transparent background is recommended.</span>
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">Apply to pages</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOverlayPages("all")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${overlayPages === "all" ? "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]" : "border-white/10 text-white/50"}`}>All pages</button>
                  <button onClick={() => setOverlayPages("selected")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${overlayPages === "selected" ? "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]" : "border-white/10 text-white/50"}`}>Selected pages</button>
                </div>
                {overlayPages === "selected" && (
                  <input value={overlayPageRange} onChange={(event) => setOverlayPageRange(event.target.value)} placeholder="Example: 1,3,5 or 2-6" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60" />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">Position</label>
                  <select value={overlayPosition} onChange={(event) => setOverlayPosition(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60">
                    <option value="top-left">Top left</option><option value="top-center">Top center</option><option value="top-right">Top right</option>
                    <option value="middle-left">Middle left</option><option value="center">Center</option><option value="middle-right">Middle right</option>
                    <option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option><option value="bottom-right">Bottom right</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">Size</label>
                  <select value={overlaySize} onChange={(event) => setOverlaySize(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ccff00]/60">
                    <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex justify-between text-sm"><label className="font-semibold text-white/70">Opacity</label><span className="text-white/40">{overlayOpacity}%</span></div>
                  <input type="range" min="10" max="100" value={overlayOpacity} onChange={(event) => setOverlayOpacity(Number(event.target.value))} className="w-full accent-[#ccff00]" />
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm"><label className="font-semibold text-white/70">Rotation</label><span className="text-white/40">{overlayRotation}°</span></div>
                  <input type="range" min="-180" max="180" step="1" value={overlayRotation} onChange={(event) => setOverlayRotation(Number(event.target.value))} className="w-full accent-[#ccff00]" />
                </div>
              </div>

              <div className="rounded-2xl border border-[#ccff00]/15 bg-[#ccff00]/5 p-4 text-xs text-white/50">
                <span className="font-semibold text-[#ccff00]">Advanced:</span> You can use an image, text, or both for a stamp. Select specific pages, adjust opacity and rotation, then apply it in one click.
              </div>
            </div>
          )}

          {files.length > 0 && tool !== "merge" && (
            <div className="mt-5 space-y-2">
              {files.map((file, index) => (
                <div key={file.name + index} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="truncate text-sm">{index + 1}. {file.name}</span>
                  <button onClick={() => removeFile(index)} className="ml-4 text-xs text-white/40 hover:text-white">Remove</button>
                </div>
              ))}
            </div>
          )}

          {busy && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                <span className="truncate text-white/55">{progressLabel || "Processing..."}</span>
                <span className="font-bold text-[#ccff00]">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#ccff00] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={tool === "merge" ? openMergeReview : process}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-[#ccff00] px-6 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing..." :
             tool === "merge" ? "Continue →" :
             tool === "split" ? "Split PDF →" :
             tool === "jpg" ? "Create PDF →" :
             tool === "images" ? "Convert to JPG →" :
             tool === "rotate" ? "Rotate PDF →" :
             tool === "delete" ? "Delete Pages →" :
             tool === "reorder" ? "Reorder PDF →" :
             tool === "stamp" ? `Add ${overlayType === "stamp" ? "Stamp" : "Signature"} →` : "Optimize PDF →"}
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
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}



async function hasValidFileSignature(file: File, isImage: boolean) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  if (!isImage) {
    return bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
  }

  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  return jpeg || png;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}
