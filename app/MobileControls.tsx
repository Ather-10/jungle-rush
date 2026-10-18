
"use client";

import React from "react";

const controls = [
  { label: "LEFT", key: "ArrowLeft", symbol: "←" },
  { label: "JUMP", key: "ArrowUp", symbol: "↑" },
  { label: "RIGHT", key: "ArrowRight", symbol: "→" },
  { label: "SLIDE", key: "ArrowDown", symbol: "↓" },
];

export default function MobileControls() {
  function press(key: string) {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
      })
    );
  }

  function release(key: string) {
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        key,
        bubbles: true,
      })
    );
  }

  return (
    <div className="mobile-controls">
      {controls.map((control) => (
        <button
          key={control.key}
          type="button"
          aria-label={control.label}
          onPointerDown={(event) => {
            event.preventDefault();
            press(control.key);
          }}
          onPointerUp={() => release(control.key)}
          onPointerCancel={() => release(control.key)}
          onPointerLeave={() => release(control.key)}
        >
          <span>{control.symbol}</span>
          <small>{control.label}</small>
        </button>
      ))}
    </div>
  );
}
