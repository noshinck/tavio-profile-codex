import http from "node:http";
import {
  activateCard,
  getDefaultDashboardStats,
  getDashboardStats,
  initializeDatabase,
  getCardByCode,
  getCardViews,
  incrementCardViews,
  logActionClick,
  logContactSave,
  logLead,
  saveSharedContact
} from "./db.js";

initializeDatabase();

const port = Number(process.env.PORT || 3000);
const googleSheetsLeadUrl =
  "https://script.google.com/macros/s/AKfycbxipnzHxNs_5dXazkI7SCYqa_DtIa4ZFUMHgtnlRU8MV7rltMns3cynA0WosnXX6ooX/exec";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderPage({
  eyebrow,
  title,
  description,
  details = "",
  script = "",
  bodyClass = "",
  panelClass = ""
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NFC Business Card</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0a0a0b;
        --surface: #171717;
        --surface-soft: #1d1d1d;
        --border: #2b2b2b;
        --text: #f4f4f5;
        --muted: #8d8d93;
        --button: #6f86ff;
        --button-text: #ffffff;
        --theme-accent: #6f86ff;
        --theme-accent-rgb: 111, 134, 255;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: Arial, Helvetica, sans-serif;
        background: #050505;
        color: var(--text);
      }

      .ambient-background {
        position: fixed;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        background:
          radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0) 44%),
          #050505;
      }

      .ambient-orb {
        position: absolute;
        border-radius: 999px;
        filter: blur(88px);
        opacity: 0.3;
        will-change: transform, opacity;
        mix-blend-mode: screen;
        animation: ambientFloat 16s ease-in-out infinite alternate;
      }

      .ambient-orb.one {
        top: 12%;
        left: 12%;
        width: 420px;
        height: 420px;
        background: radial-gradient(circle, rgba(104, 124, 255, 0.46) 0%, rgba(104, 124, 255, 0) 72%);
      }

      .ambient-orb.two {
        right: 10%;
        bottom: 14%;
        width: 420px;
        height: 420px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 74%);
        animation-duration: 19s;
        animation-delay: -6s;
      }

      .ambient-orb.three {
        left: 42%;
        top: 52%;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(106, 255, 196, 0.18) 0%, rgba(106, 255, 196, 0) 74%);
        animation-duration: 22s;
        animation-delay: -11s;
      }

      @keyframes ambientFloat {
        0% {
          transform: translate3d(0, 0, 0) scale(1);
          opacity: 0.2;
        }

        50% {
          transform: translate3d(34px, -26px, 0) scale(1.08);
          opacity: 0.34;
        }

        100% {
          transform: translate3d(-28px, 22px, 0) scale(0.96);
          opacity: 0.24;
        }
      }

      .body-top {
        align-items: flex-start;
      }

      .panel {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 360px;
        padding: 28px 22px 22px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(28, 28, 28, 0.98), rgba(17, 17, 17, 0.98));
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
      }

      .panel-wide {
        max-width: 1100px;
        padding: 28px;
      }

      .eyebrow {
        margin: 0 0 18px;
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: 22px;
        line-height: 1.15;
        font-weight: 400;
      }

      .description {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.4;
      }

      .form {
        margin-top: 24px;
        display: grid;
        gap: 12px;
        text-align: left;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field-label {
        color: var(--muted);
        font-size: 13px;
      }

      .input {
        width: 100%;
        min-height: 46px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface-soft);
        color: var(--text);
        font-size: 15px;
        outline: none;
      }

      .input::placeholder {
        color: #6f6f76;
      }

      .avatar {
        position: relative;
        width: 92px;
        height: 92px;
        margin: 0 auto;
        border-radius: 50%;
        display: grid;
        place-items: center;
        overflow: hidden;
        font-size: 26px;
        color: #dfdfe4;
        border: 1px solid #3a3a3a;
        background:
          radial-gradient(circle at 50% 30%, #3a3a3a 0%, #2a2a2a 36%, #1d1d1d 100%);
        box-shadow:
          inset 0 0 0 2px rgba(255, 255, 255, 0.04),
          0 12px 28px rgba(0, 0, 0, 0.32);
        transition: transform 200ms ease, opacity 200ms ease;
      }

      .avatar-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: translateY(var(--avatar-offset-y, 0px)) scale(var(--avatar-scale, 1));
        transform-origin: center center;
        transition: opacity 220ms ease;
      }

      .range-input {
        accent-color: #f4f4f5;
        padding: 0;
        min-height: auto;
        background: transparent;
        border: 0;
      }

      .avatar.has-image .avatar-image {
        opacity: 1;
      }

      .avatar-text {
        position: relative;
        z-index: 1;
      }

      .avatar.has-image .avatar-text {
        opacity: 0;
      }

      .profile-block {
        position: relative;
        text-align: center;
      }

      .identity-banner {
        position: relative;
        width: calc(100% + 44px);
        margin: -28px -22px 0;
        min-height: 132px;
        border-radius: 24px 24px 18px 18px;
        overflow: hidden;
        background:
          linear-gradient(135deg, rgba(79, 97, 196, 0.6), rgba(35, 35, 42, 0.42) 52%, rgba(18, 18, 22, 0.9)),
          radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 44%);
      }

      .banner-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 260ms ease;
      }

      .identity-banner.has-image .banner-image {
        opacity: 1;
      }

      .identity-banner::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(10, 10, 12, 0.05), rgba(10, 10, 12, 0.38) 72%, rgba(10, 10, 12, 0.5));
      }

      .identity-avatar-wrap {
        position: relative;
        z-index: 1;
        margin-top: -44px;
      }

      .identity-stack {
        margin-top: 14px;
        display: grid;
        gap: 6px;
      }

      .edit-trigger {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 2;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: rgba(18, 18, 22, 0.22);
        backdrop-filter: blur(12px);
        color: rgba(244, 244, 245, 0.82);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        transition:
          transform 180ms ease,
          background 180ms ease,
          border-color 180ms ease,
          color 180ms ease;
      }

      .edit-trigger:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(244, 244, 245, 0.96);
      }

      .edit-trigger .icon,
      .edit-trigger .icon svg {
        width: 15px;
        height: 15px;
      }

      .profile-name {
        margin: 0;
        font-size: 22px;
        line-height: 1.1;
        font-weight: 600;
      }

      .role {
        margin-top: 0;
        color: rgba(244, 244, 245, 0.72);
        font-size: 14px;
        text-transform: none;
      }

      .headline {
        color: rgba(214, 214, 220, 0.82);
        font-size: 13px;
        line-height: 1.45;
      }

      .company {
        color: rgba(244, 244, 245, 0.58);
        font-size: 12px;
        line-height: 1.35;
      }

      .location {
        color: rgba(244, 244, 245, 0.46);
        font-size: 12px;
        line-height: 1.35;
      }

      .identity-line.is-empty {
        display: none;
      }

      .bio {
        margin: 16px auto 0;
        max-width: 260px;
        color: #a6a6ad;
        font-size: 14px;
        line-height: 1.6;
        text-align: center;
      }

      .primary-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        margin-top: 26px;
        min-height: 52px;
        padding: 14px 16px;
        border-radius: 14px;
        border: 0;
        background: linear-gradient(135deg, var(--theme-accent), rgba(var(--theme-accent-rgb), 0.9));
        color: var(--button-text);
        font-size: 15px;
        font-weight: 600;
        box-shadow:
          0 14px 30px rgba(var(--theme-accent-rgb), 0.28),
          0 0 0 1px rgba(255, 255, 255, 0.18),
          0 0 22px rgba(var(--theme-accent-rgb), 0.18);
        text-decoration: none;
        transition:
          transform 180ms ease,
          box-shadow 220ms ease,
          opacity 180ms ease,
          filter 220ms ease;
      }

      .primary-button:hover {
        transform: translateY(-1px);
        box-shadow:
          0 16px 38px rgba(var(--theme-accent-rgb), 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.22),
          0 0 30px rgba(var(--theme-accent-rgb), 0.22);
      }

      .primary-button.is-saving {
        opacity: 0.94;
        filter: saturate(0.9);
      }

      .primary-button.is-saved {
        transform: translateY(0);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(244, 244, 245, 0.72);
        box-shadow: none;
      }

      .save-text {
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .save-trust {
        margin-top: 14px;
        text-align: center;
        color: rgba(244, 244, 245, 0.72);
        font-size: 13px;
        line-height: 1.5;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .save-helper {
        margin-top: 8px;
        text-align: center;
        color: rgba(244, 244, 245, 0.56);
        font-size: 13px;
        line-height: 1.5;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .save-trust.is-hidden,
      .save-helper.is-hidden {
        opacity: 0;
        transform: translateY(-4px);
      }

      .action-section {
        margin-top: 16px;
      }

      .action-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .action-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 48px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition:
          transform 180ms ease,
          background 180ms ease,
          border-color 180ms ease,
          box-shadow 180ms ease;
      }

      .action-button:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(var(--theme-accent-rgb), 0.3);
      }

      .action-button .icon,
      .action-button .icon svg {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
      }

      .action-button.is-whatsapp {
        min-height: 52px;
        margin-top: 12px;
        border-color: rgba(114, 255, 166, 0.18);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(68, 171, 104, 0.08));
        box-shadow: 0 0 20px rgba(88, 198, 125, 0.08);
      }

      .social-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }

      .social-button {
        min-height: 44px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
        color: rgba(244, 244, 245, 0.88);
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }

      .social-button:hover {
        transform: translateY(-1px);
        border-color: rgba(var(--theme-accent-rgb), 0.34);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.98);
      }

      .skills-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 10px;
      }

      .skill-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(244, 244, 245, 0.88);
        font-size: 12px;
        line-height: 1;
        transition: transform 200ms ease, opacity 200ms ease, border-color 200ms ease;
      }

      .skill-chip:hover {
        border-color: rgba(var(--theme-accent-rgb), 0.34);
      }

      .skill-chip.is-entering {
        opacity: 0;
        transform: translateY(4px) scale(0.96);
      }

      .chip-remove {
        width: 18px;
        height: 18px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(244, 244, 245, 0.74);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }

      .footer {
        margin-top: 18px;
        text-align: center;
        color: #67676d;
        font-size: 12px;
        letter-spacing: 0.12em;
      }

      .mini-analytics {
        margin-top: 16px;
        display: flex;
        align-items: stretch;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(10px);
      }

      .mini-stat {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-align: center;
      }

      .mini-stat-value {
        color: rgba(255, 255, 255, 0.96);
        text-shadow: 0 0 16px rgba(255, 255, 255, 0.14);
        font-weight: 600;
        font-size: 22px;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      .mini-stat-label {
        color: rgba(244, 244, 245, 0.6);
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .stats-grid {
        display: grid;
        gap: 12px;
        margin-top: 24px;
      }

      .dashboard-shell {
        width: 100%;
        max-width: 860px;
        margin: 0 auto;
      }

      .dashboard-header {
        margin-bottom: 20px;
      }

      .dashboard-title {
        margin: 0;
        font-size: 32px;
        line-height: 1.05;
        font-weight: 600;
      }

      .dashboard-subtitle {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.5;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        align-items: start;
      }

      .dashboard-card {
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
      }

      .dashboard-label {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dashboard-value {
        margin-top: 12px;
        font-size: 34px;
        font-weight: 600;
        line-height: 1;
      }

      .dashboard-note {
        margin-top: 10px;
        color: rgba(244, 244, 245, 0.62);
        font-size: 13px;
      }

      .edit-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        align-items: start;
      }

      .edit-column {
        min-width: 0;
      }

      .edit-form-card {
        padding: 20px;
      }

      .edit-form {
        margin-top: 0;
      }

      .form-section {
        display: grid;
        gap: 14px;
        padding: 18px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.02);
      }

      .section-title {
        margin: 0;
        color: rgba(244, 244, 245, 0.6);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .skills-builder {
        display: grid;
        gap: 12px;
      }

      .skills-input-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
      }

      .inline-button {
        min-height: 46px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(244, 244, 245, 0.92);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .color-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .color-dot {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 2px solid transparent;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
      }

      .color-dot:hover {
        transform: translateY(-1px) scale(1.04);
      }

      .color-dot.is-active {
        transform: scale(1.08);
        border-color: rgba(255, 255, 255, 0.88);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.16),
          0 0 16px rgba(var(--theme-accent-rgb), 0.25);
      }

      .edit-save-button {
        margin-top: 8px;
      }

      .preview-column {
        display: flex;
        align-items: flex-start;
        justify-content: center;
      }

      .preview-wrap {
        width: 100%;
        display: flex;
        justify-content: center;
      }

      .preview-card {
        width: 100%;
        max-width: 360px;
        padding: 22px;
        overflow: hidden;
      }

      .preview-card .profile-block {
        margin-top: 0;
      }

      .preview-card .identity-banner {
        margin-top: -22px;
      }

      .preview-card .edit-trigger {
        pointer-events: none;
      }

      .preview-card .mini-analytics {
        width: 100%;
        margin-top: 18px;
      }

      .preview-fade {
        transition:
          opacity 200ms ease,
          transform 200ms ease,
          filter 200ms ease;
      }

      .preview-fade.is-updating {
        opacity: 0.78;
        transform: translateY(2px);
        filter: saturate(0.92);
      }

      .share-back {
        margin-top: 8px;
        padding: 10px 0 0;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        opacity: 0;
        max-height: 0;
        overflow: hidden;
        transform: translateY(8px);
        transition:
          opacity 220ms ease,
          transform 220ms ease,
          max-height 260ms ease,
          margin-top 220ms ease,
          padding 220ms ease;
      }

      .share-back.is-visible {
        opacity: 1;
        max-height: 520px;
        transform: translateY(0);
      }

      .share-title {
        margin: 0;
        text-align: left;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 600;
        color: rgba(244, 244, 245, 0.92);
      }

      .share-note {
        margin: 6px 0 0;
        text-align: left;
        color: rgba(244, 244, 245, 0.68);
        font-size: 13px;
        line-height: 1.5;
      }

      .share-speed {
        margin-top: 8px;
        text-align: center;
        color: rgba(244, 244, 245, 0.34);
        font-size: 12px;
        line-height: 1.4;
      }

      .share-button {
        margin-top: 12px;
        min-height: 46px;
      }

      .share-status {
        margin-top: 10px;
        text-align: center;
        color: rgba(244, 244, 245, 0.72);
        font-size: 13px;
        min-height: 18px;
      }

      .share-form.is-complete {
        opacity: 0.72;
      }

      .share-input {
        min-height: 44px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.34);
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(2, 2, 3, 0.68);
        backdrop-filter: blur(12px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease;
      }

      .modal-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
      }

      .modal-shell {
        position: relative;
        width: min(100%, 1120px);
        max-height: calc(100vh - 36px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        overflow: hidden;
        background: rgba(10, 10, 11, 0.92);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
        transform: translateY(8px) scale(0.985);
        transition: transform 220ms ease;
      }

      .modal-backdrop.is-open .modal-shell {
        transform: translateY(0) scale(1);
      }

      .modal-close {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 2;
        width: 38px;
        height: 38px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        background: rgba(19, 19, 20, 0.88);
        color: rgba(244, 244, 245, 0.82);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .modal-frame {
        width: 100%;
        height: min(860px, calc(100vh - 36px));
        border: 0;
        display: block;
        background: #050505;
      }

      .stat-card {
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.02);
      }

      .stat-label {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .stat-value {
        margin-top: 10px;
        font-size: 28px;
        font-weight: 600;
      }

      .divider {
        margin: 0 8px;
      }

      .icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        flex: 0 0 14px;
      }

      .icon svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .social-button .icon,
      .social-button .icon svg {
        width: 16px;
        height: 16px;
      }

      @media (max-width: 767px) {
        body.profile-page {
          padding: 0;
          align-items: stretch;
          justify-content: stretch;
        }

        body.profile-page .ambient-background {
          background:
            radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 34%),
            linear-gradient(180deg, #09090b 0%, #050505 100%);
        }

        .panel.profile-panel {
          max-width: none;
          min-height: 100vh;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          background: transparent;
          padding: 20px 20px 28px;
        }

        .profile-panel .profile-block {
          padding-top: 14px;
        }

        .profile-panel .identity-banner {
          width: calc(100% + 40px);
          min-height: 136px;
          margin: -20px -20px 0;
          border-radius: 0 0 22px 22px;
        }

        .profile-panel .edit-trigger {
          top: 14px;
          right: 14px;
        }

        .profile-panel .avatar {
          width: 96px;
          height: 96px;
        }

        .profile-panel .identity-avatar-wrap {
          margin-top: -40px;
        }

        .profile-panel .profile-name {
          font-size: 28px;
        }

        .profile-panel .role {
          margin-top: 10px;
        }

        .profile-panel .bio {
          margin-top: 18px;
        }

        .profile-panel .primary-button {
          min-height: 56px;
          margin-top: 20px;
          border-radius: 16px;
        }

        .profile-panel .save-trust,
        .profile-panel .save-helper,
        .profile-panel .action-section,
        .profile-panel .social-grid,
        .profile-panel .mini-analytics,
        .profile-panel .footer {
          margin-top: 16px;
        }

        .profile-panel .action-button {
          min-height: 52px;
          border-radius: 14px;
        }

        .profile-panel .action-button.is-whatsapp {
          min-height: 56px;
        }

        .profile-panel .social-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .profile-panel .social-button {
          min-height: 48px;
          border-radius: 14px;
        }

        .profile-panel .mini-analytics {
          padding: 16px 14px;
          border-radius: 18px;
        }

        .profile-panel .share-back {
          margin-top: 16px;
          padding-top: 14px;
        }
      }

      @media (min-width: 768px) {
        body { padding: 32px; }
        .panel { padding: 32px 26px 24px; }
        .panel-wide { padding: 32px; }
      }

      @media (max-width: 360px) {
        .social-grid {
          gap: 8px;
        }
      }

      @media (max-width: 640px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }

        .edit-grid {
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .dashboard-title {
          font-size: 28px;
        }

        .panel-wide {
          padding: 22px 18px;
        }
      }
    </style>
  </head>
  <body class="${bodyClass}">
    <div class="ambient-background" aria-hidden="true">
      <div class="ambient-orb one"></div>
      <div class="ambient-orb two"></div>
      <div class="ambient-orb three"></div>
    </div>
    <main class="panel ${panelClass}">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      <p class="description">${description}</p>
      ${details}
    </main>
    ${script}
  </body>
</html>`;
}

function renderHome() {
  return renderPage({
    eyebrow: "NFC Business Card",
    title: "Open a card route",
    description:
      "Visit /u/ABCD123 for an activated card, /u/WXYZ789 for a non-activated card, or /dashboard/ABCD123 for the dashboard."
  });
}

function renderActivation(cardCode) {
  const details = `
    <form class="form" method="POST" action="/u/${encodeURIComponent(cardCode)}/activate">
      <label class="field">
        <span class="field-label">Name</span>
        <input class="input" type="text" name="name" placeholder="Enter your name" required />
      </label>
      <label class="field">
        <span class="field-label">Phone</span>
        <input class="input" type="tel" name="phone" placeholder="Enter your phone" required />
      </label>
      <label class="field">
        <span class="field-label">Email</span>
        <input class="input" type="email" name="email" placeholder="Enter your email" required />
      </label>
      <label class="field">
        <span class="field-label">Profession</span>
        <input class="input" type="text" name="profession" placeholder="Enter your profession" required />
      </label>
      <button class="primary-button" type="submit">Activate Card</button>
    </form>
  `;

  return renderPage({
    eyebrow: "Card Activation",
    title: "Activate your card",
    description: `Card code ${escapeHtml(cardCode)} is ready to be linked to your profile.`,
    details
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function iconSvg(name) {
  const icons = {
    briefcase:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7V6a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1"/><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M4 11h16"/><path d="M10 13h4"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/><path d="M5 19h14"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 4h2.6l1.5 4-1.8 1.7a13.8 13.8 0 0 0 5.2 5.2l1.7-1.8 4 1.5v2.6a1.6 1.6 0 0 1-1.7 1.6A15.9 15.9 0 0 1 5.2 5.7 1.6 1.6 0 0 1 6.8 4Z"/></svg>',
    email:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="m5.5 8 6.5 5 6.5-5"/></svg>',
    whatsapp:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20a8 8 0 1 0-4.5-1.4L5 20l1.5-2.4A8 8 0 0 0 12 20Z"/><path d="M9.6 9.2c.3-.7.7-.7 1-.7h.3c.1 0 .3 0 .4.3l.9 2.1c.1.2 0 .3 0 .4l-.3.5c-.1.1-.2.2-.1.4.2.3.6.9 1.3 1.4.8.6 1.5.8 1.8.9.2.1.4 0 .5-.1l.6-.7c.1-.1.3-.1.4-.1l1.9.9c.2.1.3.2.3.3 0 .2-.1.9-.6 1.2-.4.3-.9.4-1.2.4-.3 0-.7.1-3.1-.8-2.8-1.1-4.6-3.9-4.7-4.1-.1-.2-.8-1-.8-2s.5-1.4.7-1.6Z"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="4"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9v8"/><path d="M12 17v-4.5a2.5 2.5 0 0 1 5 0V17"/><path d="M12 9v8"/><circle cx="7" cy="6.8" r="1"/></svg>',
    twitter:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19"/><path d="M19 5 5 19"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C17.3 5 12 5 12 5s-5.3 0-6.8.5a2.5 2.5 0 0 0-1.8 1.8C3 8.8 3 12 3 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C6.7 19 12 19 12 19s5.3 0 6.8-.5a2.5 2.5 0 0 0 1.8-1.8C21 15.2 21 12 21 12Z"/><path d="m10 9 5 3-5 3z"/></svg>',
    facebook:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 20v-7h2.5l.5-3H13V8.3c0-.9.3-1.5 1.6-1.5H16V4.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4V10H7v3h2.9v7"/></svg>',
    website:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4a12 12 0 0 1 0 16"/><path d="M12 4a12 12 0 0 0 0 16"/></svg>',
    github:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18c-4 1.2-4-2-5.5-2.5"/><path d="M14.5 21v-3a2.6 2.6 0 0 0-.8-2c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 18 6.8 4.3 4.3 0 0 0 17.9 4s-1 0-3.4 1.6a11.7 11.7 0 0 0-6 0C6.1 4 5.1 4 5.1 4A4.3 4.3 0 0 0 5 6.8 4.7 4.7 0 0 0 3.8 10c0 4.7 2.8 5.7 5.5 6a2.6 2.6 0 0 0-.8 2v3"/></svg>',
    telegram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 4-3 15-5-4-3 2 1-5 10-8-13 5 3 1"/></svg>',
    snapchat:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c2.6 0 4.5 2 4.5 4.7v2.1c0 .4.2.7.5.9.4.3 1 .6 1.5.7-.3.6-.9 1-1.7 1.2-.4.1-.6.4-.7.8-.2 1-.8 1.8-1.8 2.1-.7.2-1.3.3-2.3.3s-1.6-.1-2.3-.3c-1-.3-1.6-1.1-1.8-2.1-.1-.4-.3-.7-.7-.8-.8-.2-1.4-.6-1.7-1.2.5-.1 1.1-.4 1.5-.7.3-.2.5-.5.5-.9V8.7C7.5 6 9.4 4 12 4Z"/></svg>',
    portfolio:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10H4z"/><path d="M9 7V6a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1"/><path d="M4 11h16"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 9.3-9.3a1.8 1.8 0 0 0 0-2.6l-.6-.6a1.8 1.8 0 0 0-2.6 0L5 15.8 4 20Z"/><path d="M13.5 7.5 16.5 10.5"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18"/><path d="M18 6 6 18"/></svg>'
  };

  return icons[name] ?? "";
}

function buildVCard(card) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.name}`,
    `TEL;TYPE=CELL:${card.phone}`,
    `EMAIL:${card.email}`,
    "END:VCARD"
  ].join("\r\n");
}

function getProfileStorageKey(cardCode) {
  return `tavio_profile_${cardCode}`;
}

function getDefaultProfileData(card) {
  return {
    name: card.name || "",
    role: card.profession || "",
    headline: card.bio || "",
    company: "",
    location: "",
    phone: card.phone || "",
    email: card.email || "",
    profileInitial: "",
    profileImage: "",
    bannerImage: "",
    profileImageScale: 1,
    profileImageOffsetY: 0,
    skills: [],
    themeColor: "blue",
    socials: {
      instagram: card.instagram_url || "",
      linkedin: card.linkedin_url || "",
      twitter: card.twitter_url || "",
      youtube: card.youtube_url || "",
      facebook: card.facebook_url || "",
      website: card.website_url || "",
      github: card.github_url || "",
      telegram: card.telegram_url || "",
      snapchat: card.snapchat_url || "",
      portfolio: card.portfolio_url || ""
    }
  };
}

function buildTrackedTarget(cardCode, action, target) {
  return `/u/${encodeURIComponent(cardCode)}/out?action=${encodeURIComponent(action)}&target=${encodeURIComponent(target)}`;
}

function renderTrackedAction(cardCode, action, target, label, icon, extraClass = "") {
  return `<a class="action-button${extraClass ? ` ${extraClass}` : ""}" data-track-click="true" href="${buildTrackedTarget(cardCode, action, target)}">
    <span class="icon">${iconSvg(icon)}</span>
    <span>${label}</span>
  </a>`;
}

function renderSocialButton(cardCode, action, target, label, icon) {
  return `<a class="social-button" data-track-click="true" href="/u/${encodeURIComponent(cardCode)}/out?action=${encodeURIComponent(action)}&target=${encodeURIComponent(target)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
    <span class="icon">${iconSvg(icon)}</span>
  </a>`;
}

function renderProfile(card, views) {
  const whatsappPhone = card.phone.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappPhone}`;
  const defaultProfile = getDefaultProfileData(card);
  const socialLinks = [
    {
      key: "instagram_url",
      icon: "instagram",
      label: "Instagram",
      action: "instagram"
    },
    {
      key: "linkedin_url",
      icon: "linkedin",
      label: "LinkedIn",
      action: "linkedin"
    },
    {
      key: "twitter_url",
      icon: "twitter",
      label: "Twitter",
      action: "twitter"
    },
    {
      key: "youtube_url",
      icon: "youtube",
      label: "YouTube",
      action: "youtube"
    },
    {
      key: "facebook_url",
      icon: "facebook",
      label: "Facebook",
      action: "facebook"
    },
    {
      key: "website_url",
      icon: "website",
      label: "Website",
      action: "website"
    },
    {
      key: "github_url",
      icon: "github",
      label: "GitHub",
      action: "github"
    },
    {
      key: "telegram_url",
      icon: "telegram",
      label: "Telegram",
      action: "telegram"
    },
    {
      key: "snapchat_url",
      icon: "snapchat",
      label: "Snapchat",
      action: "snapchat"
    },
    {
      key: "portfolio_url",
      icon: "portfolio",
      label: "Portfolio",
      action: "portfolio"
    }
  ]
    .filter((item) => typeof card[item.key] === "string" && card[item.key].trim() !== "")
    .map((item) =>
      renderSocialButton(card.card_code, item.action, card[item.key].trim(), item.label, item.icon)
    )
    .join("");

  const details = `
    <section class="profile-block">
      <div class="identity-banner" id="profile-banner">
        <img class="banner-image" id="profile-banner-image" alt="" />
        <button class="edit-trigger" id="edit-profile-trigger" type="button" aria-label="Edit Profile" title="Edit Profile">
          <span class="icon">${iconSvg("edit")}</span>
        </button>
      </div>
      <div class="identity-avatar-wrap">
        <div class="avatar" id="profile-avatar">
          <img class="avatar-image" id="profile-avatar-image" alt="" />
          <span class="avatar-text" id="profile-avatar-text">${escapeHtml(getInitials(card.name))}</span>
        </div>
      </div>
      <div class="identity-stack">
        <h1 class="profile-name" id="profile-name">${escapeHtml(card.name)}</h1>
        <div class="role" id="profile-role-text">${escapeHtml(card.profession)}</div>
        <div class="company identity-line is-empty" id="profile-company"></div>
        <div class="headline identity-line${card.bio ? "" : " is-empty"}" id="profile-headline">${escapeHtml(card.bio || "")}</div>
        <div class="location identity-line is-empty" id="profile-location"></div>
        <div class="skills-row" id="profile-skills" style="display: none;"></div>
      </div>
    </section>
    <a class="primary-button" id="save-contact-button" data-contact-base="/u/${encodeURIComponent(card.card_code)}/contact.vcf" href="/u/${encodeURIComponent(card.card_code)}/contact.vcf">
      <span class="icon">${iconSvg("download")}</span>
      <span class="save-text">Save My Contact</span>
    </a>
    <div class="save-trust" id="save-trust">Safe • No app needed</div>
    <div class="save-helper" id="save-helper"></div>
    <div class="action-section">
      <div class="action-grid" id="action-grid">
        ${renderTrackedAction(card.card_code, "call", `tel:${card.phone}`, "Call", "phone")}
        ${renderTrackedAction(card.card_code, "email", `mailto:${card.email}`, "Email", "email")}
      </div>
      ${renderTrackedAction(card.card_code, "whatsapp", whatsappUrl, "WhatsApp", "whatsapp", "is-whatsapp")}
    </div>
    <div class="social-grid" id="social-grid">${socialLinks}</div>
    <section class="share-back" id="share-back-section">
      <h2 class="share-title">Saved ✔ You&apos;re now connected</h2>
      <p class="share-note">Want me to save your contact too?</p>
      <form class="form share-form" id="share-back-form">
        <label class="field">
          <input class="input share-input" id="name" type="text" name="name" placeholder="Your name" required />
        </label>
        <label class="field">
          <input class="input share-input" id="phone" type="tel" name="phone" placeholder="Phone" required />
        </label>
        <label class="field">
          <input class="input share-input" id="email" type="email" name="email" placeholder="Email" required />
        </label>
        <button class="primary-button share-button" type="button" onclick="handleShare()">
          <span class="icon">${iconSvg("download")}</span>
          <span>Share My Contact</span>
        </button>
        <div class="share-status" id="share-back-status"></div>
      </form>
      <div class="share-speed">Takes 5 seconds</div>
    </section>
    <div class="mini-analytics" aria-label="Analytics">
      <div class="mini-stat">
        <span class="mini-stat-value" id="views-count">0</span>
        <span class="mini-stat-label">Views</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-value" id="saves-count">0</span>
        <span class="mini-stat-label">Saves</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-value" id="clicks-count">0</span>
        <span class="mini-stat-label">Actions</span>
      </div>
    </div>
    <div class="footer">${escapeHtml(card.card_code)}</div>
    <div class="modal-backdrop" id="edit-profile-modal" aria-hidden="true">
      <div class="modal-shell">
        <button class="modal-close" id="edit-profile-close" type="button" aria-label="Close edit profile">
          <span class="icon">${iconSvg("close")}</span>
        </button>
        <iframe class="modal-frame" id="edit-profile-frame" src="/edit/${encodeURIComponent(card.card_code)}" title="Edit Profile"></iframe>
      </div>
    </div>
  `;

  const script = `
	    <script>
      (() => {
        const cardCode = ${serializeForScript(card.card_code)};
        const storageKey = ${serializeForScript(getProfileStorageKey(card.card_code))};
        const profileImageKey = "tavio_profile_image";
        const bannerImageKey = "tavio_banner_image";
        const skillsKey = "tavio_skills";
        const themeKey = "tavio_theme";
        const defaultProfile = ${serializeForScript(defaultProfile)};
        const button = document.getElementById("save-contact-button");
        const shareSection = document.getElementById("share-back-section");
        const shareStatus = document.getElementById("share-back-status");
        const shareButton = document.querySelector(".share-button");
        const trust = document.getElementById("save-trust");
        const helper = document.getElementById("save-helper");
        const viewsCount = document.getElementById("views-count");
        const savesCount = document.getElementById("saves-count");
        const clicksCount = document.getElementById("clicks-count");
        const nameElement = document.getElementById("profile-name");
        const roleElement = document.getElementById("profile-role-text");
        const companyElement = document.getElementById("profile-company");
        const headlineElement = document.getElementById("profile-headline");
        const locationElement = document.getElementById("profile-location");
        const skillsElement = document.getElementById("profile-skills");
        const avatarElement = document.getElementById("profile-avatar");
        const avatarImageElement = document.getElementById("profile-avatar-image");
        const avatarTextElement = document.getElementById("profile-avatar-text");
        const bannerElement = document.getElementById("profile-banner");
        const bannerImageElement = document.getElementById("profile-banner-image");
        const socialGrid = document.getElementById("social-grid");
        const actionGrid = document.getElementById("action-grid");
        const actionSection = document.querySelector(".action-section");
        const editTrigger = document.getElementById("edit-profile-trigger");
        const editModal = document.getElementById("edit-profile-modal");
        const editClose = document.getElementById("edit-profile-close");
        const editFrame = document.getElementById("edit-profile-frame");
        if (!button) return;

        const text = button.querySelector(".save-text");
        let resetTimer = null;
        let isSharing = false;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        const incrementStat = (key) => {
          const currentValue = Number.parseInt(localStorage.getItem(key) || "0", 10);
          const nextValue = Number.isNaN(currentValue) ? 1 : currentValue + 1;
          localStorage.setItem(key, String(nextValue));
          renderStats();
          return nextValue;
        };

        const readStat = (key) => {
          const value = Number.parseInt(localStorage.getItem(key) || "0", 10);
          return Number.isNaN(value) ? 0 : value;
        };

        const renderStats = () => {
          if (viewsCount) viewsCount.textContent = String(readStat("tavio_views"));
          if (savesCount) savesCount.textContent = String(readStat("tavio_saves"));
          if (clicksCount) clicksCount.textContent = String(readStat("tavio_clicks"));
        };

        incrementStat("tavio_views");
        renderStats();

        document.addEventListener("click", (event) => {
          const target = event.target.closest('[data-track-click="true"]');
          if (target) {
            incrementStat("tavio_clicks");
          }
        });

        const deriveInitials = (name) =>
          String(name || "")
            .trim()
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "NN";

        const themeMap = {
          red: "#ef4444",
          blue: "#6f86ff",
          green: "#22c55e",
          purple: "#8b5cf6",
          orange: "#f97316"
        };

        const hexToRgb = (hex) => {
          const normalized = String(hex || "").replace("#", "");
          const value = normalized.length === 3
            ? normalized.split("").map((char) => char + char).join("")
            : normalized;
          const int = Number.parseInt(value, 16);
          if (Number.isNaN(int)) return "111, 134, 255";
          return [int >> 16 & 255, int >> 8 & 255, int & 255].join(", ");
        };

        const applyTheme = (themeName) => {
          const hex = themeMap[themeName] || themeMap.blue;
          document.documentElement.style.setProperty("--theme-accent", hex);
          document.documentElement.style.setProperty("--theme-accent-rgb", hexToRgb(hex));
        };

        const buildActionHref = (action, target) =>
          \`/u/\${encodeURIComponent(cardCode)}/out?action=\${encodeURIComponent(action)}&target=\${encodeURIComponent(target)}\`;

        const renderActionButtons = (profile) => {
          if (!actionGrid || !actionSection) return;
          const safePhone = profile.phone || "";
          const whatsappPhone = safePhone.replace(/\\D/g, "");
          const topButtons = [
            {
              label: "Call",
              icon: ${serializeForScript(iconSvg("phone"))},
              href: buildActionHref("call", \`tel:\${safePhone}\`)
            },
            {
              label: "Email",
              icon: ${serializeForScript(iconSvg("email"))},
              href: buildActionHref("email", \`mailto:\${profile.email || ""}\`)
            }
          ]
            .map((item) => \`<a class="action-button" data-track-click="true" href="\${item.href}"><span class="icon">\${item.icon}</span><span>\${item.label}</span></a>\`)
            .join("");
          const whatsappButton = \`<a class="action-button is-whatsapp" data-track-click="true" href="\${buildActionHref("whatsapp", \`https://wa.me/\${whatsappPhone}\`)}"><span class="icon">${iconSvg("whatsapp")}</span><span>WhatsApp</span></a>\`;
          actionGrid.innerHTML = topButtons;
          const existingWhatsapp = actionSection.querySelector(".action-button.is-whatsapp");
          if (existingWhatsapp) {
            existingWhatsapp.remove();
          }
          actionSection.insertAdjacentHTML("beforeend", whatsappButton);
        };

        const socialConfig = [
          { key: "instagram", label: "Instagram", icon: ${serializeForScript(iconSvg("instagram"))}, action: "instagram" },
          { key: "linkedin", label: "LinkedIn", icon: ${serializeForScript(iconSvg("linkedin"))}, action: "linkedin" },
          { key: "twitter", label: "Twitter", icon: ${serializeForScript(iconSvg("twitter"))}, action: "twitter" },
          { key: "youtube", label: "YouTube", icon: ${serializeForScript(iconSvg("youtube"))}, action: "youtube" },
          { key: "facebook", label: "Facebook", icon: ${serializeForScript(iconSvg("facebook"))}, action: "facebook" },
          { key: "website", label: "Website", icon: ${serializeForScript(iconSvg("website"))}, action: "website" },
          { key: "github", label: "GitHub", icon: ${serializeForScript(iconSvg("github"))}, action: "github" },
          { key: "telegram", label: "Telegram", icon: ${serializeForScript(iconSvg("telegram"))}, action: "telegram" },
          { key: "snapchat", label: "Snapchat", icon: ${serializeForScript(iconSvg("snapchat"))}, action: "snapchat" },
          { key: "portfolio", label: "Portfolio", icon: ${serializeForScript(iconSvg("portfolio"))}, action: "portfolio" }
        ];

        const renderSocialButtons = (profile) => {
          if (!socialGrid) return;
          const socials = profile.socials || {};
          const buttons = socialConfig
            .filter((item) => socials[item.key])
            .map((item) => \`<a class="social-button" data-track-click="true" href="\${buildActionHref(item.action, socials[item.key])}" target="_blank" rel="noopener noreferrer" aria-label="\${item.label}" title="\${item.label}"><span class="icon">\${item.icon}</span></a>\`)
            .join("");
          socialGrid.innerHTML = buttons;
          socialGrid.style.display = buttons ? "grid" : "none";
        };

        const readStoredProfile = () => {
          try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("tavio_profile") || "{}");
            return {
              ...defaultProfile,
              ...stored,
              socials: {
                ...defaultProfile.socials,
                ...(stored.socials || {})
              }
            };
          } catch (error) {
            return defaultProfile;
          }
        };

        const readStoredImages = () => ({
          profileImage: localStorage.getItem(profileImageKey) || "",
          bannerImage: localStorage.getItem(bannerImageKey) || ""
        });

        const readStoredExtras = () => {
          let skills = [];
          try {
            skills = JSON.parse(localStorage.getItem(skillsKey) || "[]");
          } catch (error) {
            skills = [];
          }

          return {
            skills: Array.isArray(skills) ? skills : [],
            themeColor: localStorage.getItem(themeKey) || defaultProfile.themeColor || "blue"
          };
        };

        const profileState = {
          ...readStoredProfile(),
          ...readStoredImages(),
          ...readStoredExtras()
        };

        const openEditModal = () => {
          if (!editModal) return;
          editModal.classList.add("is-open");
          editModal.setAttribute("aria-hidden", "false");
          document.body.style.overflow = "hidden";
        };

        const closeEditModal = () => {
          if (!editModal) return;
          editModal.classList.remove("is-open");
          editModal.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
          updateProfileUI({
            ...readStoredProfile(),
            ...readStoredImages(),
            ...readStoredExtras()
          });
        };

        const updateProfileUI = (profile) => {
          if (nameElement) nameElement.textContent = profile.name || defaultProfile.name;
          if (roleElement) roleElement.textContent = profile.role || defaultProfile.role;
          if (companyElement) {
            const company = profile.company || defaultProfile.company || "";
            companyElement.textContent = company;
            companyElement.classList.toggle("is-empty", !company);
          }
          if (headlineElement) {
            const headline = profile.headline || defaultProfile.headline || "";
            headlineElement.textContent = headline;
            headlineElement.classList.toggle("is-empty", !headline);
          }
          if (locationElement) {
            const location = profile.location || defaultProfile.location || "";
            locationElement.textContent = location;
            locationElement.classList.toggle("is-empty", !location);
          }
          if (skillsElement) {
            const skills = Array.isArray(profile.skills) ? profile.skills : [];
            skillsElement.innerHTML = skills.map((skill) => \`<span class="skill-chip">\${skill}</span>\`).join("");
            skillsElement.style.display = skills.length ? "flex" : "none";
          }
          applyTheme(profile.themeColor || defaultProfile.themeColor || "blue");
          const initials = (profile.profileInitial || deriveInitials(profile.name || defaultProfile.name)).slice(0, 2).toUpperCase();
          if (avatarTextElement) avatarTextElement.textContent = initials;
          if (avatarElement) avatarElement.classList.toggle("has-image", Boolean(profile.profileImage));
          if (avatarImageElement) {
            if (profile.profileImage) {
              avatarImageElement.src = profile.profileImage;
            } else {
              avatarImageElement.removeAttribute("src");
            }
            avatarImageElement.style.setProperty("--avatar-scale", String(profile.profileImageScale || 1));
            avatarImageElement.style.setProperty("--avatar-offset-y", (profile.profileImageOffsetY || 0) + "px");
          }
          if (bannerElement) bannerElement.classList.toggle("has-image", Boolean(profile.bannerImage));
          if (bannerImageElement) {
            if (profile.bannerImage) {
              bannerImageElement.src = profile.bannerImage;
            } else {
              bannerImageElement.removeAttribute("src");
            }
          }
          button.href = \`\${button.dataset.contactBase}?\${new URLSearchParams({
            name: profile.name || "",
            phone: profile.phone || "",
            email: profile.email || ""
          }).toString()}\`;
          renderActionButtons(profile);
          renderSocialButtons(profile);
        };

        updateProfileUI(profileState);

        if (editTrigger) {
          editTrigger.addEventListener("click", openEditModal);
        }

        if (editClose) {
          editClose.addEventListener("click", closeEditModal);
        }

        if (editModal) {
          editModal.addEventListener("click", (event) => {
            if (event.target === editModal) {
              closeEditModal();
            }
          });
        }

        if (editFrame) {
          editFrame.addEventListener("load", () => {
            if (editModal && editModal.classList.contains("is-open")) {
              updateProfileUI({
                ...readStoredProfile(),
                ...readStoredImages(),
                ...readStoredExtras()
              });
            }
          });
        }

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && editModal && editModal.classList.contains("is-open")) {
            closeEditModal();
          }
        });

        window.handleShare = async function handleShare() {
          const name = document.querySelector("#name")?.value;
          const phone = document.querySelector("#phone")?.value;
          const email = document.querySelector("#email")?.value;

          if (!name || !phone || !email) {
            alert("Fill all fields");
            return;
          }

          if (isSharing) return;
          isSharing = true;
          if (shareButton) shareButton.disabled = true;
          if (shareStatus) shareStatus.textContent = "";

          try {
            await fetch("/api/save-contact", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name,
                phone,
                email
              })
            });

            if (shareStatus) shareStatus.textContent = "Saved ✅ You're now connected";
            incrementStat("tavio_saves");
            const form = document.getElementById("share-back-form");
            if (form) form.reset();
            alert("Saved successfully");
          } catch (err) {
            console.error(err);
            if (shareStatus) shareStatus.textContent = "Something went wrong ❌";
            alert("Network error");
          } finally {
            isSharing = false;
            if (shareButton) shareButton.disabled = false;
          }
        };

	        const setState = (state) => {
          button.classList.remove("is-saving", "is-saved");

          if (state === "saving") {
            button.classList.add("is-saving");
            if (text) text.textContent = "Saving...";
            return;
          }

          if (state === "saved") {
            button.classList.add("is-saved");
            if (text) text.textContent = "Saved ✔";
            if (trust) trust.classList.add("is-hidden");
            if (helper) {
              helper.classList.remove("is-hidden");
              helper.textContent = "Want me to save your contact too?";
            }
            if (shareSection) shareSection.classList.add("is-visible");
            return;
          }

          if (trust) trust.classList.remove("is-hidden");
          if (helper) {
            helper.classList.remove("is-hidden");
            helper.textContent = "";
          }

          if (text) text.textContent = "Save My Contact";
        };

        button.addEventListener("click", async (event) => {
          event.preventDefault();

          if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
          }

          setState("saving");

	          try {
	            incrementStat("tavio_saves");

	            if (navigator.vibrate) {
	              navigator.vibrate(18);
	            }

            if (isMobile) {
              setState("saved");
              window.setTimeout(() => {
                window.location.href = button.href;
              }, 120);
              return;
            }

            const response = await fetch(button.href);
            if (!response.ok) throw new Error("download failed");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "${encodeURIComponent(card.name)}.vcf";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            setState("saved");
            resetTimer = window.setTimeout(() => {
              setState("idle");
            }, 1800);
          } catch (error) {
            setState("idle");
          }
        });
      })();
	    </script>
  `;

  return renderPage({
    eyebrow: "",
    title: "",
    description: "",
    details,
    script,
    bodyClass: "profile-page",
    panelClass: "profile-panel"
  });
}

function renderEditProfilePage(card) {
  const defaultProfile = getDefaultProfileData(card);
  const details = `
    <div class="dashboard-shell">
      <div class="dashboard-header">
        <h1 class="dashboard-title">Edit Profile</h1>
        <p class="dashboard-subtitle">Update your public card details and preview changes live.</p>
      </div>
      <div class="edit-grid">
        <div class="edit-column">
          <div class="dashboard-card edit-form-card">
            <form class="form edit-form" id="edit-profile-form">
              <section class="form-section">
                <p class="section-title">Bio</p>
                <label class="field"><span class="field-label">Name</span><input class="input" name="name" type="text" placeholder="Full name" /></label>
                <label class="field"><span class="field-label">Role</span><input class="input" name="role" type="text" placeholder="Role" /></label>
                <label class="field"><span class="field-label">Headline</span><input class="input" name="headline" type="text" placeholder="Video Editor | Grovix" /></label>
                <label class="field"><span class="field-label">Company</span><input class="input" name="company" type="text" placeholder="Grovix" /></label>
                <label class="field"><span class="field-label">Location</span><input class="input" name="location" type="text" placeholder="Bangalore, India" /></label>
                <label class="field"><span class="field-label">Phone</span><input class="input" name="phone" type="tel" placeholder="Phone" /></label>
                <label class="field"><span class="field-label">Email</span><input class="input" name="email" type="email" placeholder="Email" /></label>
                <label class="field"><span class="field-label">Profile Initial</span><input class="input" name="profileInitial" type="text" maxlength="2" placeholder="NN" /></label>
                <label class="field"><span class="field-label">Upload Profile Image</span><input class="input" name="profileImageUpload" type="file" accept="image/*" /></label>
                <label class="field"><span class="field-label">Profile Image Zoom</span><input class="input range-input" name="profileImageScale" type="range" min="1" max="2.2" step="0.01" /></label>
                <label class="field"><span class="field-label">Profile Image Position</span><input class="input range-input" name="profileImageOffsetY" type="range" min="-32" max="32" step="1" /></label>
                <label class="field"><span class="field-label">Upload Banner Image</span><input class="input" name="bannerImageUpload" type="file" accept="image/*" /></label>
              </section>
              <section class="form-section">
                <p class="section-title">Skills</p>
                <div class="skills-builder">
                  <div class="skills-input-row">
                    <input class="input" id="skill-input" type="text" placeholder="Add a skill" />
                    <button class="inline-button" id="add-skill-button" type="button">Add</button>
                  </div>
                  <div class="skills-row" id="editor-skills"></div>
                </div>
              </section>
              <section class="form-section">
                <p class="section-title">Social Links</p>
                <label class="field"><span class="field-label">Instagram</span><input class="input" name="instagram" type="url" placeholder="https://instagram.com/..." /></label>
                <label class="field"><span class="field-label">LinkedIn</span><input class="input" name="linkedin" type="url" placeholder="https://linkedin.com/in/..." /></label>
                <label class="field"><span class="field-label">Twitter (X)</span><input class="input" name="twitter" type="url" placeholder="https://x.com/..." /></label>
                <label class="field"><span class="field-label">YouTube</span><input class="input" name="youtube" type="url" placeholder="https://youtube.com/..." /></label>
                <label class="field"><span class="field-label">Facebook</span><input class="input" name="facebook" type="url" placeholder="https://facebook.com/..." /></label>
                <label class="field"><span class="field-label">Website</span><input class="input" name="website" type="url" placeholder="https://example.com" /></label>
                <label class="field"><span class="field-label">GitHub</span><input class="input" name="github" type="url" placeholder="https://github.com/..." /></label>
                <label class="field"><span class="field-label">Telegram</span><input class="input" name="telegram" type="url" placeholder="https://t.me/..." /></label>
                <label class="field"><span class="field-label">Snapchat</span><input class="input" name="snapchat" type="url" placeholder="https://snapchat.com/add/..." /></label>
                <label class="field"><span class="field-label">Portfolio link</span><input class="input" name="portfolio" type="url" placeholder="https://portfolio.com" /></label>
              </section>
              <section class="form-section">
                <p class="section-title">Style</p>
                <div class="color-grid" id="theme-color-grid"></div>
              </section>
              <button class="primary-button edit-save-button" type="submit">Save Profile</button>
              <div class="share-status" id="edit-save-status"></div>
            </form>
          </div>
        </div>
        <div class="edit-column preview-column">
          <div class="preview-wrap">
            <div class="dashboard-card preview-card">
              <div class="field-label">Live Preview</div>
              <div class="profile-block preview-fade" id="edit-preview-block" style="margin-top: 18px;">
                <div class="identity-banner" id="edit-preview-banner">
                  <img class="banner-image" id="edit-preview-banner-image" alt="" />
                  <button class="edit-trigger" type="button" aria-label="Edit Profile" title="Edit Profile">
                    <span class="icon">${iconSvg("edit")}</span>
                  </button>
                </div>
                <div class="identity-avatar-wrap">
                  <div class="avatar" id="edit-preview-avatar">
                    <img class="avatar-image" id="edit-preview-avatar-image" alt="" />
                    <span class="avatar-text" id="edit-preview-avatar-text">${escapeHtml(getInitials(card.name))}</span>
                  </div>
                </div>
                <div class="identity-stack">
                  <h2 class="profile-name" id="edit-preview-name">${escapeHtml(card.name)}</h2>
                  <div class="role" id="edit-preview-role">${escapeHtml(card.profession)}</div>
                  <div class="company identity-line is-empty" id="edit-preview-company"></div>
                  <div class="headline identity-line${card.bio ? "" : " is-empty"}" id="edit-preview-headline">${escapeHtml(card.bio || "")}</div>
                  <div class="location identity-line is-empty" id="edit-preview-location"></div>
                  <div class="skills-row" id="edit-preview-skills" style="display: none;"></div>
                </div>
                <div class="bio" id="edit-preview-contact">${escapeHtml(card.phone)} • ${escapeHtml(card.email)}</div>
                <div class="social-grid" id="edit-preview-socials" style="margin-top: 16px; display: none;"></div>
                <div class="mini-analytics">
                  <div class="mini-stat"><span class="mini-stat-value">12</span><span class="mini-stat-label">Views</span></div>
                  <div class="mini-stat"><span class="mini-stat-value">5</span><span class="mini-stat-label">Saves</span></div>
                  <div class="mini-stat"><span class="mini-stat-value">3</span><span class="mini-stat-label">Actions</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const script = `
    <script>
      (() => {
        const cardCode = ${serializeForScript(card.card_code)};
        const storageKey = ${serializeForScript(getProfileStorageKey(card.card_code))};
        const profileImageKey = "tavio_profile_image";
        const bannerImageKey = "tavio_banner_image";
        const skillsKey = "tavio_skills";
        const themeKey = "tavio_theme";
        const defaults = ${serializeForScript(defaultProfile)};
        const form = document.getElementById("edit-profile-form");
        const status = document.getElementById("edit-save-status");
        const skillInput = document.getElementById("skill-input");
        const addSkillButton = document.getElementById("add-skill-button");
        const editorSkills = document.getElementById("editor-skills");
        const themeColorGrid = document.getElementById("theme-color-grid");
        const previewName = document.getElementById("edit-preview-name");
        const previewRole = document.getElementById("edit-preview-role");
        const previewCompany = document.getElementById("edit-preview-company");
        const previewAvatar = document.getElementById("edit-preview-avatar");
        const previewAvatarImage = document.getElementById("edit-preview-avatar-image");
        const previewAvatarText = document.getElementById("edit-preview-avatar-text");
        const previewBanner = document.getElementById("edit-preview-banner");
        const previewBannerImage = document.getElementById("edit-preview-banner-image");
        const previewHeadline = document.getElementById("edit-preview-headline");
        const previewLocation = document.getElementById("edit-preview-location");
        const previewSkills = document.getElementById("edit-preview-skills");
        const previewContact = document.getElementById("edit-preview-contact");
        const previewSocials = document.getElementById("edit-preview-socials");
        const previewBlock = document.getElementById("edit-preview-block");
        if (!form) return;

        const deriveInitials = (name) =>
          String(name || "")
            .trim()
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "NN";

        const socialConfig = [
          { key: "instagram", label: "Instagram", icon: ${serializeForScript(iconSvg("instagram"))} },
          { key: "linkedin", label: "LinkedIn", icon: ${serializeForScript(iconSvg("linkedin"))} },
          { key: "twitter", label: "Twitter", icon: ${serializeForScript(iconSvg("twitter"))} },
          { key: "youtube", label: "YouTube", icon: ${serializeForScript(iconSvg("youtube"))} },
          { key: "facebook", label: "Facebook", icon: ${serializeForScript(iconSvg("facebook"))} },
          { key: "website", label: "Website", icon: ${serializeForScript(iconSvg("website"))} },
          { key: "github", label: "GitHub", icon: ${serializeForScript(iconSvg("github"))} },
          { key: "telegram", label: "Telegram", icon: ${serializeForScript(iconSvg("telegram"))} },
          { key: "snapchat", label: "Snapchat", icon: ${serializeForScript(iconSvg("snapchat"))} },
          { key: "portfolio", label: "Portfolio", icon: ${serializeForScript(iconSvg("portfolio"))} }
        ];

        const themeOptions = [
          { key: "red", color: "#ef4444" },
          { key: "blue", color: "#6f86ff" },
          { key: "green", color: "#22c55e" },
          { key: "purple", color: "#8b5cf6" },
          { key: "orange", color: "#f97316" }
        ];

        const hexToRgb = (hex) => {
          const normalized = String(hex || "").replace("#", "");
          const value = normalized.length === 3
            ? normalized.split("").map((char) => char + char).join("")
            : normalized;
          const int = Number.parseInt(value, 16);
          if (Number.isNaN(int)) return "111, 134, 255";
          return [int >> 16 & 255, int >> 8 & 255, int & 255].join(", ");
        };

        const applyTheme = (themeName) => {
          const current = themeOptions.find((item) => item.key === themeName) || themeOptions[1];
          document.documentElement.style.setProperty("--theme-accent", current.color);
          document.documentElement.style.setProperty("--theme-accent-rgb", hexToRgb(current.color));
        };

        const readStored = () => {
          try {
            const saved =
              localStorage.getItem("tavio_profile") ||
              localStorage.getItem(storageKey) ||
              "{}";
            const stored = JSON.parse(saved);
            return {
              ...defaults,
              ...stored,
              socials: {
                ...defaults.socials,
                ...(stored.socials || {})
              }
            };
          } catch (error) {
            return defaults;
          }
        };

        const profileData = {
          ...readStored(),
          profileImage: localStorage.getItem(profileImageKey) || "",
          bannerImage: localStorage.getItem(bannerImageKey) || "",
          skills: (() => {
            try {
              const storedSkills = JSON.parse(localStorage.getItem(skillsKey) || "[]");
              return Array.isArray(storedSkills) ? storedSkills : [];
            } catch (error) {
              return [];
            }
          })(),
          themeColor: localStorage.getItem(themeKey) || defaults.themeColor || "blue"
        };

        const readFileAsDataUrl = (file, { maxSize = 1200, quality = 0.82 } = {}) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const image = new Image();
              image.onload = () => {
                const longestSide = Math.max(image.width, image.height) || 1;
                const scale = Math.min(1, maxSize / longestSide);
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d");

                if (!context) {
                  reject(new Error("canvas_unavailable"));
                  return;
                }

                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
              };
              image.onerror = () => reject(new Error("image_decode_failed"));
              image.src = String(reader.result || "");
            };
            reader.onerror = () => reject(new Error("file_read_failed"));
            reader.readAsDataURL(file);
          });

        const applyToForm = () => {
          form.elements.name.value = profileData.name || "";
          form.elements.role.value = profileData.role || "";
          form.elements.headline.value = profileData.headline || "";
          form.elements.company.value = profileData.company || "";
          form.elements.location.value = profileData.location || "";
          form.elements.phone.value = profileData.phone || "";
          form.elements.email.value = profileData.email || "";
          form.elements.profileInitial.value = profileData.profileInitial || "";
          form.elements.profileImageScale.value = String(profileData.profileImageScale || 1);
          form.elements.profileImageOffsetY.value = String(profileData.profileImageOffsetY || 0);
          form.elements.instagram.value = profileData.socials.instagram || "";
          form.elements.linkedin.value = profileData.socials.linkedin || "";
          form.elements.twitter.value = profileData.socials.twitter || "";
          form.elements.youtube.value = profileData.socials.youtube || "";
          form.elements.facebook.value = profileData.socials.facebook || "";
          form.elements.website.value = profileData.socials.website || "";
          form.elements.github.value = profileData.socials.github || "";
          form.elements.telegram.value = profileData.socials.telegram || "";
          form.elements.snapchat.value = profileData.socials.snapchat || "";
          form.elements.portfolio.value = profileData.socials.portfolio || "";
        };

        const renderEditorSkills = () => {
          if (!editorSkills) return;
          editorSkills.innerHTML = profileData.skills.map((skill, index) =>
            '<span class="skill-chip"><span>' + skill + '</span><button class="chip-remove" type="button" data-skill-index="' + index + '">×</button></span>'
          ).join("");
        };

        const renderThemePicker = () => {
          if (!themeColorGrid) return;
          themeColorGrid.innerHTML = themeOptions.map((item) =>
            '<button class="color-dot' + (profileData.themeColor === item.key ? ' is-active' : '') + '" type="button" data-theme-color="' + item.key + '" style="background:' + item.color + '" aria-label="' + item.key + ' theme" title="' + item.key + '"></button>'
          ).join("");
        };

        const updatePreview = () => {
          if (previewBlock) {
            previewBlock.classList.add("is-updating");
            window.clearTimeout(updatePreview.timeoutId);
            updatePreview.timeoutId = window.setTimeout(() => {
              previewBlock.classList.remove("is-updating");
            }, 200);
          }

          if (previewName) previewName.textContent = profileData.name || defaults.name || "Your Name";
          if (previewRole) previewRole.textContent = profileData.role || defaults.role || "Your Role";
          if (previewCompany) {
            const company = profileData.company || defaults.company || "";
            previewCompany.textContent = company;
            previewCompany.classList.toggle("is-empty", !company);
          }
          if (previewHeadline) {
            const headline = profileData.headline || defaults.headline || "";
            previewHeadline.textContent = headline;
            previewHeadline.classList.toggle("is-empty", !headline);
          }
          if (previewLocation) {
            const location = profileData.location || defaults.location || "";
            previewLocation.textContent = location;
            previewLocation.classList.toggle("is-empty", !location);
          }
          if (previewSkills) {
            previewSkills.innerHTML = profileData.skills.map((skill) => '<span class="skill-chip">' + skill + '</span>').join("");
            previewSkills.style.display = profileData.skills.length ? "flex" : "none";
          }
          applyTheme(profileData.themeColor || defaults.themeColor || "blue");
          renderEditorSkills();
          renderThemePicker();
          if (previewAvatar) {
            const initials =
              profileData.profileInitial ||
              deriveInitials(profileData.name || defaults.name || "Your Name");
            previewAvatar.classList.toggle("has-image", Boolean(profileData.profileImage));
            if (previewAvatarImage) {
              if (profileData.profileImage) {
                previewAvatarImage.src = profileData.profileImage;
              } else {
                previewAvatarImage.removeAttribute("src");
              }
              previewAvatarImage.style.setProperty("--avatar-scale", String(profileData.profileImageScale || 1));
              previewAvatarImage.style.setProperty("--avatar-offset-y", (profileData.profileImageOffsetY || 0) + "px");
            }
            if (previewAvatarText) {
              previewAvatarText.textContent = initials;
            }
          }
          if (previewBanner) {
            previewBanner.classList.toggle("has-image", Boolean(profileData.bannerImage));
          }
          if (previewBannerImage) {
            if (profileData.bannerImage) {
              previewBannerImage.src = profileData.bannerImage;
            } else {
              previewBannerImage.removeAttribute("src");
            }
          }
          if (previewContact) {
            const phone = profileData.phone || defaults.phone || "Your phone";
            const email = profileData.email || defaults.email || "your@email.com";
            previewContact.textContent = phone + " • " + email;
          }
          if (previewSocials) {
            const buttons = socialConfig
              .filter((item) => profileData.socials[item.key])
              .map(
                (item) =>
                  '<a class="social-button" href="' +
                  profileData.socials[item.key] +
                  '" target="_blank" rel="noopener noreferrer" aria-label="' +
                  item.label +
                  '" title="' +
                  item.label +
                  '"><span class="icon">' +
                  item.icon +
                  "</span></a>"
              )
              .join("");
            previewSocials.innerHTML = buttons;
            previewSocials.style.display = buttons ? "grid" : "none";
          }
        };

        const syncFromForm = () => {
          profileData.name = form.elements.name.value.trim();
          profileData.role = form.elements.role.value.trim();
          profileData.headline = form.elements.headline.value.trim();
          profileData.company = form.elements.company.value.trim();
          profileData.location = form.elements.location.value.trim();
          profileData.phone = form.elements.phone.value.trim();
          profileData.email = form.elements.email.value.trim();
          profileData.profileInitial = form.elements.profileInitial.value.trim().slice(0, 2).toUpperCase();
          profileData.profileImageScale = Number.parseFloat(form.elements.profileImageScale.value || "1") || 1;
          profileData.profileImageOffsetY = Number.parseInt(form.elements.profileImageOffsetY.value || "0", 10) || 0;
          profileData.socials.instagram = form.elements.instagram.value.trim();
          profileData.socials.linkedin = form.elements.linkedin.value.trim();
          profileData.socials.twitter = form.elements.twitter.value.trim();
          profileData.socials.youtube = form.elements.youtube.value.trim();
          profileData.socials.facebook = form.elements.facebook.value.trim();
          profileData.socials.website = form.elements.website.value.trim();
          profileData.socials.github = form.elements.github.value.trim();
          profileData.socials.telegram = form.elements.telegram.value.trim();
          profileData.socials.snapchat = form.elements.snapchat.value.trim();
          profileData.socials.portfolio = form.elements.portfolio.value.trim();
          updatePreview();
        };

        applyToForm();
        updatePreview();

        form.addEventListener("input", () => {
          syncFromForm();
          if (status) status.textContent = "";
        });

        const addSkill = () => {
          if (!skillInput) return;
          const value = skillInput.value.trim();
          if (!value) return;
          if (!profileData.skills.includes(value)) {
            profileData.skills.push(value);
            updatePreview();
          }
          skillInput.value = "";
          if (status) status.textContent = "";
        };

        if (addSkillButton) {
          addSkillButton.addEventListener("click", addSkill);
        }

        if (skillInput) {
          skillInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addSkill();
            }
          });
        }

        if (editorSkills) {
          editorSkills.addEventListener("click", (event) => {
            const button = event.target.closest("[data-skill-index]");
            if (!button) return;
            const index = Number.parseInt(button.getAttribute("data-skill-index") || "-1", 10);
            if (index < 0) return;
            profileData.skills.splice(index, 1);
            updatePreview();
            if (status) status.textContent = "";
          });
        }

        if (themeColorGrid) {
          themeColorGrid.addEventListener("click", (event) => {
            const button = event.target.closest("[data-theme-color]");
            if (!button) return;
            profileData.themeColor = button.getAttribute("data-theme-color") || "blue";
            updatePreview();
            if (status) status.textContent = "";
          });
        }

        form.elements.profileImageUpload.addEventListener("change", async (event) => {
          const file = event.target.files && event.target.files[0];
          if (!file) return;
          try {
            profileData.profileImage = await readFileAsDataUrl(file, { maxSize: 720, quality: 0.84 });
            updatePreview();
            if (status) status.textContent = "";
          } catch (error) {
            if (status) status.textContent = "Image upload failed";
          }
        });

        form.elements.bannerImageUpload.addEventListener("change", async (event) => {
          const file = event.target.files && event.target.files[0];
          if (!file) return;
          try {
            profileData.bannerImage = await readFileAsDataUrl(file, { maxSize: 1400, quality: 0.82 });
            updatePreview();
            if (status) status.textContent = "";
          } catch (error) {
            if (status) status.textContent = "Image upload failed";
          }
        });

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          try {
            localStorage.setItem("tavio_profile", JSON.stringify(profileData));
            localStorage.setItem(storageKey, JSON.stringify(profileData));
            localStorage.setItem(profileImageKey, profileData.profileImage || "");
            localStorage.setItem(bannerImageKey, profileData.bannerImage || "");
            localStorage.setItem(skillsKey, JSON.stringify(profileData.skills || []));
            localStorage.setItem(themeKey, profileData.themeColor || "blue");
            if (status) status.textContent = "Saved";
          } catch (error) {
            if (status) status.textContent = "Save failed. Try smaller images.";
          }
        });
      })();
    </script>
  `;

  return renderPage({
    eyebrow: "Edit",
    title: "",
    description: "",
    details,
    script,
    bodyClass: "body-top",
    panelClass: "panel-wide"
  });
}

function renderDashboard(stats) {
  const conversionRate =
    stats.totalProfileVisits > 0
      ? ((stats.totalContactsSaved / stats.totalProfileVisits) * 100).toFixed(1)
      : "0.0";

  const details = `
    <div class="dashboard-shell">
      <div class="dashboard-header">
        <h1 class="dashboard-title">Analytics Dashboard</h1>
        <p class="dashboard-subtitle">Minimal performance numbers you can show clients with confidence.</p>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="dashboard-label">Total Views</div>
          <div class="dashboard-value">${stats.totalProfileVisits}</div>
          <div class="dashboard-note">Profile visits for card ${escapeHtml(stats.cardCode)}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">Total Saves</div>
          <div class="dashboard-value">${stats.totalContactsSaved}</div>
          <div class="dashboard-note">How many people saved the contact</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">Total Clicks</div>
          <div class="dashboard-value">${stats.totalClicks}</div>
          <div class="dashboard-note">Tracked call and email action clicks</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">Conversion Rate</div>
          <div class="dashboard-value">${conversionRate}%</div>
          <div class="dashboard-note">Saves divided by views</div>
        </div>
      </div>
    </div>
  `;

  return renderPage({
    eyebrow: "Dashboard",
    title: "",
    description: "",
    details,
    bodyClass: "body-top",
    panelClass: "panel-wide"
  });
}

function renderNotFound() {
  return renderPage({
    eyebrow: "Not Found",
    title: "Card not found",
    description: "The card code in this link does not match any record in the database."
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
  const { pathname } = requestUrl;

  if (pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderHome());
    return;
  }

  const match = pathname.match(/^\/u\/([A-Za-z0-9_-]+)$/);
  const activationMatch = pathname.match(/^\/u\/([A-Za-z0-9_-]+)\/activate$/);
  const contactMatch = pathname.match(/^\/u\/([A-Za-z0-9_-]+)\/contact\.vcf$/);
  const outboundMatch = pathname.match(/^\/u\/([A-Za-z0-9_-]+)\/out$/);
  const shareBackMatch = pathname.match(/^\/u\/([A-Za-z0-9_-]+)\/share-back$/);
  const dashboardMatch = pathname.match(/^\/dashboard\/([A-Za-z0-9_-]+)$/);
  const editMatch = pathname.match(/^\/edit\/([A-Za-z0-9_-]+)$/);

  if (request.method === "GET" && pathname === "/dashboard") {
    const stats = getDefaultDashboardStats();

    if (!stats) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderDashboard(stats));
    return;
  }

  if (request.method === "GET" && pathname === "/edit") {
    const stats = getDefaultDashboardStats();

    if (!stats) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    const card = getCardByCode(stats.cardCode);

    if (!card) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderEditProfilePage(card));
    return;
  }

  if (request.method === "GET" && editMatch) {
    const cardCode = editMatch[1];
    const card = getCardByCode(cardCode);

    if (!card) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderEditProfilePage(card));
    return;
  }

  if (request.method === "GET" && dashboardMatch) {
    const cardCode = dashboardMatch[1];
    const stats = getDashboardStats(cardCode);

    if (!stats) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderDashboard(stats));
    return;
  }

  if (request.method === "GET" && outboundMatch) {
    const cardCode = outboundMatch[1];
    const card = getCardByCode(cardCode);
    const action = requestUrl.searchParams.get("action") || "click";
    const target = requestUrl.searchParams.get("target") || "/";

    if (!card) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    logActionClick(card.id, action);
    response.writeHead(302, { Location: target });
    response.end();
    return;
  }

  if (request.method === "GET" && contactMatch) {
    const cardCode = contactMatch[1];
    const card = getCardByCode(cardCode);

    if (!card || !card.is_activated) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    logContactSave(card.id);
    const overrideName = requestUrl.searchParams.get("name")?.trim();
    const overridePhone = requestUrl.searchParams.get("phone")?.trim();
    const overrideEmail = requestUrl.searchParams.get("email")?.trim();
    const vcf = buildVCard({
      ...card,
      name: overrideName || card.name,
      phone: overridePhone || card.phone,
      email: overrideEmail || card.email
    });
    const userAgent = request.headers["user-agent"] || "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);

    response.writeHead(200, {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `${isMobile ? "inline" : "attachment"}; filename="${encodeURIComponent(card.name)}.vcf"`,
      "Cache-Control": "no-store"
    });
    response.end(vcf);
    return;
  }

  if (request.method === "POST" && pathname === "/api/save-contact") {
    readRequestBody(request)
      .then(async (rawBody) => {
        let payload;

        try {
          payload = JSON.parse(rawBody || "{}");
        } catch (error) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false }));
          return;
        }

        const name = String(payload.name || "").trim();
        const phone = String(payload.phone || "").trim();
        const email = String(payload.email || "").trim();

        if (!name || !phone || !email) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false }));
          return;
        }

        const googleResponse = await fetch(googleSheetsLeadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            name,
            phone,
            email
          }),
          redirect: "follow"
        });

        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
      })
      .catch(() => {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false }));
      });

    return;
  }

  if (request.method === "POST" && activationMatch) {
    const cardCode = activationMatch[1];

    readRequestBody(request)
      .then((rawBody) => {
        const form = new URLSearchParams(rawBody);
        const name = form.get("name")?.trim() ?? "";
        const phone = form.get("phone")?.trim() ?? "";
        const email = form.get("email")?.trim() ?? "";
        const profession = form.get("profession")?.trim() ?? "";

        if (!name || !phone || !email || !profession) {
          response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          response.end(
            renderPage({
              eyebrow: "Card Activation",
              title: "Missing details",
              description: "Please fill in name, phone, email, and profession to activate this card."
            })
          );
          return;
        }

        const result = activateCard(cardCode, {
          name,
          phone,
          email,
          profession
        });

        if (!result.ok && result.reason === "not_found") {
          response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          response.end(renderNotFound());
          return;
        }

        response.writeHead(303, {
          Location: `/u/${encodeURIComponent(cardCode)}`
        });
        response.end();
      })
      .catch(() => {
        response.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        response.end(
          renderPage({
            eyebrow: "Card Activation",
            title: "Something went wrong",
            description: "Please try again."
          })
        );
      });

    return;
  }

  if (request.method === "POST" && shareBackMatch) {
    const cardCode = shareBackMatch[1];

    readRequestBody(request)
      .then((rawBody) => {
        const form = new URLSearchParams(rawBody);
        const name = form.get("name")?.trim() ?? "";
        const phone = form.get("phone")?.trim() ?? "";
        const email = form.get("email")?.trim() ?? "";

        if (!name || !phone || !email) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false }));
          return;
        }

        const result = saveSharedContact(cardCode, { name, phone, email });

        if (!result.ok) {
          response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: false }));
          return;
        }

        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
      })
      .catch(() => {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false }));
      });

    return;
  }

  if (match) {
    const cardCode = match[1];
    const card = getCardByCode(cardCode);

    if (!card) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderNotFound());
      return;
    }

    if (!card.is_activated) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderActivation(card.card_code));
      return;
    }

    logLead(card.id);
    incrementCardViews(card.card_code);
    const views = getCardViews(card.card_code);

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderProfile(card, views));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(renderNotFound());
});

server.listen(port, () => {
  console.log(`NFC business card app running at http://localhost:${port}`);
});
