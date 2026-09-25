import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PdfOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  margin?: number; // margin in mm
  title?: string;
}

/**
 * Captures an HTML element and exports it as a crisp, downloadable PDF file.
 * Handles single or multi-page slicing automatically with standard A4 dimensions.
 * Fully compatible with Tailwind CSS modern color spaces (oklch, oklab, display-p3).
 */
export async function exportElementToPdf(
  element: HTMLElement | string,
  options: PdfOptions = {}
): Promise<void> {
  const {
    filename = 'document.pdf',
    orientation = 'portrait',
    format = 'a4',
    margin = 8,
  } = options;

  const targetEl = typeof element === 'string' ? document.getElementById(element) : element;
  if (!targetEl) {
    throw new Error('Target element for PDF export not found in the DOM.');
  }

  // Save current scroll position and original element styles
  const originalScrollTop = window.scrollY;
  const origPosition = targetEl.style.position;
  const origLeft = targetEl.style.left;
  const origTop = targetEl.style.top;
  const origOpacity = targetEl.style.opacity;
  const origVisibility = targetEl.style.visibility;
  const origDisplay = targetEl.style.display;
  const origZIndex = targetEl.style.zIndex;
  const origClassName = targetEl.className;

  try {
    // Strip offscreen classes temporarily so html2canvas calculates DOM coordinates at viewport (0,0)
    targetEl.classList.remove('fixed', 'absolute', '-left-[99999px]', '-left-[9999px]', 'hidden', 'pointer-events-none');

    // Bring element temporarily into viewable coordinates (0,0) with high z-index during html2canvas setup
    targetEl.style.position = 'relative';
    targetEl.style.left = '0px';
    targetEl.style.top = '0px';
    targetEl.style.opacity = '1';
    targetEl.style.visibility = 'visible';
    targetEl.style.display = 'block';
    targetEl.style.zIndex = '9999';

    // Measure full scroll height and width before html2canvas clones the element
    const fullScrollHeight = Math.max(
      targetEl.scrollHeight || 0,
      targetEl.offsetHeight || 0,
      targetEl.getBoundingClientRect().height || 0
    );
    const fullScrollWidth = Math.max(targetEl.scrollWidth || 0, 1050);

    // Generate high resolution canvas using html2canvas-pro with OKLCH support
    const canvas = await html2canvas(targetEl, {
      scale: 2, // High resolution crisp rendering
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: fullScrollWidth,
      height: fullScrollHeight,
      windowWidth: fullScrollWidth,
      windowHeight: Math.max(fullScrollHeight, 1200),
      onclone: (clonedDoc, clonedEl) => {
        // Strip offscreen & height constraint classes so html2canvas renders full element width & height
        clonedEl.classList.remove(
          'fixed',
          'absolute',
          '-left-[99999px]',
          '-left-[9999px]',
          'hidden',
          'pointer-events-none',
          'max-h-screen',
          'overflow-hidden'
        );
        clonedEl.style.position = 'relative';
        clonedEl.style.left = '0px';
        clonedEl.style.top = '0px';
        clonedEl.style.display = 'block';
        clonedEl.style.visibility = 'visible';
        clonedEl.style.opacity = '1';
        clonedEl.style.transform = 'none';
        clonedEl.style.width = `${fullScrollWidth}px`;
        clonedEl.style.height = 'auto';
        clonedEl.style.minHeight = `${fullScrollHeight}px`;
        clonedEl.style.maxHeight = 'none';
        clonedEl.style.overflow = 'visible';

        if (clonedDoc.body) {
          clonedDoc.body.style.overflow = 'visible';
          clonedDoc.body.style.height = 'auto';
        }

        // Force visibility on all inner text containers
        const textElements = clonedEl.querySelectorAll('div, span, td, th, p, tr, table, tbody, thead');
        textElements.forEach((node: any) => {
          node.style.visibility = 'visible';
          node.style.opacity = '1';
        });
      },
    });

    // Restore element styles immediately after canvas creation
    targetEl.className = origClassName;
    targetEl.style.position = origPosition;
    targetEl.style.left = origLeft;
    targetEl.style.top = origTop;
    targetEl.style.opacity = origOpacity;
    targetEl.style.visibility = origVisibility;
    targetEl.style.display = origDisplay;
    targetEl.style.zIndex = origZIndex;

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas rendering generated an empty document image.');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Initialize jsPDF document (dimensions in mm)
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    // Calculate aspect ratio
    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let pageIndex = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Additional pages if element overflows a single A4 page
    while (heightLeft > 0) {
      pageIndex++;
      const position = margin - pageIndex * printableHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printableHeight;
    }

    // Trigger download
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } catch (err: any) {
    console.error('PDF Export Error:', err);
    // Ensure styles are restored on error as well
    targetEl.className = origClassName;
    targetEl.style.position = origPosition;
    targetEl.style.left = origLeft;
    targetEl.style.top = origTop;
    targetEl.style.opacity = origOpacity;
    targetEl.style.visibility = origVisibility;
    targetEl.style.display = origDisplay;
    targetEl.style.zIndex = origZIndex;
    throw err;
  } finally {
    window.scrollTo(0, originalScrollTop);
  }
}

