"use client";

import { useRef, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type AnalysisType =
  | "URL"
  | "EMAIL"
  | "MESSAGE"
  | "QR_CODE"
  | "PAYMENT_SCREENSHOT";

type PaymentDetails = {
  amount?: string | null;
  transactionId?: string | null;
  date?: string | null;
  displayedStatus?: string | null;
};

type AnalysisResult = {
  success?: boolean;
  scanId?: string;
  type?: string;
  trustScore?: number | null;
  scamProbability?: number | null;
  threatCategory?: string;
  classification?: string;
  explanation?: string;
  evidence?: string[];
  recommendations?: string[];
  aiStatus?: string;
  analysisMode?: string;
  scoringNote?: string;
  scoreMeaning?: string;
  limitation?: string;
  message?: string;
  extractedContent?: string;
  contentType?: string;
  extractedDetails?: PaymentDetails;
  extractedText?: string;
  verificationStatus?: string;
  verificationNote?: string;
  scannedAt?: string;
  createdAt?: string | Date;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: AnalysisResult;
} & AnalysisResult;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function Analyzer() {
  const [type, setType] = useState<AnalysisType>("MESSAGE");
  const [content, setContent] = useState("");

  const [qrImage, setQrImage] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState("");

  const [paymentImage, setPaymentImage] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const qrInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  function handleTypeChange(value: AnalysisType) {
    setType(value);
    setContent("");

    setQrImage(null);
    setQrPreview("");

    setPaymentImage(null);
    setPaymentPreview("");

    setError("");
    setResult(null);

    if (qrInputRef.current) {
      qrInputRef.current.value = "";
    }

    if (paymentInputRef.current) {
      paymentInputRef.current.value = "";
    }
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
    imageType: "QR_CODE" | "PAYMENT_SCREENSHOT",
  ) {
    const file = event.target.files?.[0];

    setError("");
    setResult(null);

    if (imageType === "QR_CODE") {
      setQrImage(null);
      setQrPreview("");
    } else {
      setPaymentImage(null);
      setPaymentPreview("");
    }

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please upload a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must be 5 MB or less.");
      event.target.value = "";
      return;
    }

    const preview = URL.createObjectURL(file);

    if (imageType === "QR_CODE") {
      setQrImage(file);
      setQrPreview(preview);
    } else {
      setPaymentImage(file);
      setPaymentPreview(preview);
    }
  }

  async function handleAnalyze(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (type === "QR_CODE" && !qrImage) {
      setError("Please upload a QR code image first.");
      return;
    }

    if (type === "PAYMENT_SCREENSHOT" && !paymentImage) {
      setError("Please upload a payment screenshot first.");
      return;
    }

    if (
      type !== "QR_CODE" &&
      type !== "PAYMENT_SCREENSHOT" &&
      !content.trim()
    ) {
      setError("Please enter content to analyze.");
      return;
    }

    const token = localStorage.getItem("trustlens_token");

    if (!token) {
      setError("Please log in before analyzing content.");
      return;
    }

    setLoading(true);

    try {
      let response: Response;

      if (type === "QR_CODE") {
        const formData = new FormData();
        formData.append("qrImage", qrImage!);

        response = await fetch(`${API_URL}/api/qr/scan`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else if (type === "PAYMENT_SCREENSHOT") {
        const formData = new FormData();
        formData.append("paymentImage", paymentImage!);

        response = await fetch(`${API_URL}/api/payment/analyze`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        response = await fetch(`${API_URL}/api/analyzer/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type,
            content: content.trim(),
          }),
        });
      }

      const responseBody =
        (await response.json()) as ApiResponse;

      if (!response.ok || !responseBody.success) {
        throw new Error(
          responseBody.message || "Analysis failed. Please try again.",
        );
      }

      // Payment API returns its result inside responseBody.data.
      // Other scanners may return the result directly.
      const normalizedResult: AnalysisResult =
        responseBody.data ?? responseBody;

      setResult({
        ...normalizedResult,
        success: true,
        type: normalizedResult.type ?? type,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend. Check whether it is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isImageMode =
    type === "QR_CODE" || type === "PAYMENT_SCREENSHOT";

  const selectedImage =
    type === "QR_CODE" ? qrImage : paymentImage;

  const selectedPreview =
    type === "QR_CODE" ? qrPreview : paymentPreview;

  const isPaymentResult =
    result?.type === "PAYMENT_SCREENSHOT" ||
    (type === "PAYMENT_SCREENSHOT" && result !== null);

  const resultCategory =
    result?.classification ?? result?.threatCategory;

  return (
    <section
      id="analyzer"
      className="mx-auto my-12 w-full max-w-4xl rounded-2xl border border-cyan-900/60 bg-slate-950/80 p-6 shadow-xl shadow-cyan-950/20 sm:p-8"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          TrustLens Scanner
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          Check before you trust.
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Analyze website URLs, emails, messages, QR codes, and
          payment screenshots for suspicious indicators. Scores
          are heuristic assessments, not guarantees of safety
          or authenticity.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-5">
        <div>
          <label
            htmlFor="analysisType"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            What do you want to analyze?
          </label>

          <select
            id="analysisType"
            value={type}
            onChange={(event) =>
              handleTypeChange(event.target.value as AnalysisType)
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            <option value="URL">Website URL</option>
            <option value="EMAIL">Email content</option>
            <option value="MESSAGE">SMS / WhatsApp / Text message</option>
            <option value="QR_CODE">QR Code Scanner</option>
            <option value="PAYMENT_SCREENSHOT">
              Payment Screenshot Analyzer
            </option>
          </select>
        </div>

        {isImageMode ? (
          <div className="space-y-4">
            <label
              htmlFor={
                type === "QR_CODE" ? "qrImage" : "paymentImage"
              }
              className="block text-sm font-medium text-slate-200"
            >
              {type === "QR_CODE"
                ? "Upload QR code image"
                : "Upload payment screenshot"}
            </label>

            <div className="rounded-xl border border-dashed border-cyan-700 bg-slate-900/70 p-6 text-center">
              <div className="mb-3 text-4xl">
                {type === "QR_CODE" ? "📷" : "🧾"}
              </div>

              <p className="mb-2 text-sm text-slate-300">
                {type === "QR_CODE"
                  ? "Select a QR code image from your device."
                  : "Select a payment screenshot to extract its visible details."}
              </p>

              <p className="mb-4 text-xs text-slate-500">
                PNG, JPEG, or WebP · Maximum 5 MB
              </p>

              <input
                ref={
                  type === "QR_CODE"
                    ? qrInputRef
                    : paymentInputRef
                }
                id={
                  type === "QR_CODE" ? "qrImage" : "paymentImage"
                }
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  handleImageChange(
                    event,
                    type as "QR_CODE" | "PAYMENT_SCREENSHOT",
                  )
                }
                className="mx-auto block w-full max-w-sm text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
              />

              {selectedImage && (
                <p className="mt-3 break-all text-sm text-cyan-300">
                  Selected: {selectedImage.name}
                </p>
              )}

              {selectedPreview && (
                <div className="mt-5">
                  <img
                    src={selectedPreview}
                    alt={
                      type === "QR_CODE"
                        ? "Selected QR code preview"
                        : "Selected payment screenshot preview"
                    }
                    className="mx-auto max-h-56 max-w-full rounded-lg border border-slate-700 object-contain"
                  />
                </div>
              )}
            </div>

            {type === "QR_CODE" ? (
              <p className="text-xs leading-5 text-amber-300">
                Safety tip: QR codes may contain malicious links.
                Verify extracted links before opening them.
              </p>
            ) : (
              <p className="text-xs leading-5 text-amber-300">
                This feature analyzes visible screenshot details.
                It cannot confirm whether money was transferred.
                Verify transactions in your official bank or UPI app.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label
              htmlFor="analysisContent"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Enter content
            </label>

            <textarea
              id="analysisContent"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setError("");
                setResult(null);
              }}
              placeholder={
                type === "URL"
                  ? "https://example.com"
                  : type === "EMAIL"
                    ? "Paste the email subject and message..."
                    : "Paste the suspicious message in English, Tamil, or Tanglish..."
              }
              rows={5}
              maxLength={10000}
              required
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <p className="mt-2 text-right text-xs text-slate-500">
              {content.length}/10000 characters
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? type === "QR_CODE"
              ? "Scanning QR Code..."
              : type === "PAYMENT_SCREENSHOT"
                ? "Analyzing Payment Screenshot..."
                : "Analyzing..."
            : type === "QR_CODE"
              ? "Scan QR Code"
              : type === "PAYMENT_SCREENSHOT"
                ? "Analyze Payment Screenshot"
                : "Analyze Now"}
        </button>
      </form>

      {result && (
        <div className="mt-8 space-y-5 border-t border-slate-800 pt-6">
          <h3 className="text-xl font-bold text-white">
            Analysis Results
          </h3>

          {isPaymentResult && (
            <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-500 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-300">
                  {result.verificationStatus || "UNVERIFIED"}
                </span>

                <span className="text-sm font-medium text-amber-200">
                  Payment authenticity has not been verified.
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                The scores below measure visible indicators and
                missing information. They do not prove whether
                a payment is genuine or fake.
              </p>
            </div>
          )}

          {result.extractedContent && (
            <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-5">
              <p className="text-sm font-medium text-cyan-300">
                Extracted QR Content
              </p>

              <p className="mt-2 break-all text-sm leading-6 text-white">
                {result.extractedContent}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Content type: {result.contentType || "Unknown"}
              </p>
            </div>
          )}

          {isPaymentResult && result.extractedDetails && (
            <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-5">
              <h4 className="font-semibold text-cyan-300">
                Extracted Payment Details
              </h4>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-400">Amount</p>
                  <p className="mt-1 break-words text-sm text-white">
                    {result.extractedDetails.amount || "Not detected"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Transaction ID
                  </p>
                  <p className="mt-1 break-words text-sm text-white">
                    {result.extractedDetails.transactionId || "Not detected"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="mt-1 break-words text-sm text-white">
                    {result.extractedDetails.date || "Not detected"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Displayed Status
                  </p>
                  <p className="mt-1 break-words text-sm text-white">
                    {result.extractedDetails.displayedStatus || "Not detected"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPaymentResult && result.extractedText && (
            <details className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <summary className="cursor-pointer font-semibold text-white">
                View OCR Extracted Text
              </summary>

              <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                {result.extractedText}
              </pre>
            </details>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                {isPaymentResult
                  ? "Screenshot Indicator Score"
                  : "Trust Score"}
              </p>

              <p className="mt-2 text-4xl font-bold text-cyan-400">
                {typeof result.trustScore === "number"
                  ? `${result.trustScore}/100`
                  : "N/A"}
              </p>

              {isPaymentResult && (
                <p className="mt-3 text-xs leading-5 text-amber-300">
                  This is a heuristic score, not proof of payment authenticity.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                {isPaymentResult
                  ? "Suspicious Indicator Score"
                  : "Heuristic Risk Indicator Score"}
              </p>

              <p className="mt-2 text-4xl font-bold text-orange-400">
                {typeof result.scamProbability === "number"
                  ? `${result.scamProbability}/100`
                  : "N/A"}
              </p>

              {isPaymentResult && result.scoreMeaning && (
                <p className="mt-3 text-xs leading-5 text-amber-300">
                  {result.scoreMeaning}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Threat Category
            </p>

            <p className="mt-2 break-words font-semibold text-white">
              {resultCategory || "Not available"}
            </p>

            {result.explanation && (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {result.explanation}
              </p>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-white">
              Detected Evidence
            </h4>

            {result.evidence?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                {result.evidence.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                No configured indicators were detected. This does
                not prove that the content is safe or authentic.
              </p>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-white">
              Safety Recommendations
            </h4>

            {result.recommendations?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                {result.recommendations.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                Verify the source independently before taking action.
              </p>
            )}
          </div>

          {isPaymentResult && result.verificationNote && (
            <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm leading-6 text-amber-200">
              <p className="font-semibold">
                Payment Verification Notice
              </p>
              <p className="mt-2">{result.verificationNote}</p>
            </div>
          )}

          {(result.analysisMode ||
            result.aiStatus ||
            result.scoringNote ||
            result.limitation) && (
            <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
              {(result.analysisMode || result.aiStatus) && (
                <p>
                  {result.analysisMode &&
                    `Analysis mode: ${result.analysisMode}`}
                  {result.analysisMode && result.aiStatus && " · "}
                  {result.aiStatus && `AI status: ${result.aiStatus}`}
                </p>
              )}

              {result.scoringNote && (
                <p className="mt-2">{result.scoringNote}</p>
              )}

              {result.limitation && (
                <p className="mt-2">{result.limitation}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}