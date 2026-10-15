import { ImageResponse } from "next/og";

import { DESCRIPTION, SITE_NAME } from "./site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The K mark from app/icon.svg, drawn in ink on a light ground.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 96,
          background: "#fcfcfc",
          color: "#111113",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 64 64">
          <g transform="translate(13.82 8.00) scale(0.72727)" fill="#111113">
            <rect width="24" height="50" rx="12" />
            <path d="M26 12C26 5.37258 31.3726 0 38 0V0C44.6274 0 50 5.37258 50 12V12C50 18.6274 44.6274 24 38 24H26V12Z" />
            <path d="M26 26H30C41.0457 26 50 34.9543 50 46V54C50 60.6274 44.6274 66 38 66V66C31.3726 66 26 60.6274 26 54V26Z" />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 36, color: "#60646c" }}>{DESCRIPTION}</div>
        </div>
      </div>
    ),
    size,
  );
}
