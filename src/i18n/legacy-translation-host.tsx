import { useEffect } from "react";
import { useI18n } from "./index";
import { LEGACY_TEXT_EXACT, LEGACY_TEXT_RULES } from "./legacy-translations.generated";

const ATTRIBUTE_NAMES = [
  "aria-label",
  "aria-placeholder",
  "placeholder",
  "title",
] as const;

const originalTextMap = new WeakMap<Text, string>();
const originalAttributeMap = new WeakMap<Element, Map<string, string>>();
const compiledLegacyRules = LEGACY_TEXT_RULES.map((rule) => ({
  pattern: new RegExp(rule.patternSource),
  replace: rule.replace,
}));
const legacyPrefixEntries = Object.entries(LEGACY_TEXT_EXACT)
  .filter(([source, target]) => /[:：]$/.test(source) && /[:：]$/.test(target))
  .sort((a, b) => b[0].length - a[0].length);

function hasChineseText(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function translateLegacyText(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const exact = LEGACY_TEXT_EXACT[normalized];
  if (exact) {
    return exact;
  }

  for (const rule of compiledLegacyRules) {
    if (rule.pattern.test(normalized)) {
      return normalized.replace(rule.pattern, rule.replace);
    }
  }

  for (const [sourcePrefix, targetPrefix] of legacyPrefixEntries) {
    if (!normalized.startsWith(sourcePrefix) || normalized === sourcePrefix) {
      continue;
    }
    const suffix = normalized.slice(sourcePrefix.length).trimStart();
    const separator = targetPrefix.endsWith(":") && suffix ? " " : "";
    return `${targetPrefix}${separator}${suffix}`;
  }

  return null;
}

function translateDisplayValue(value: string) {
  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  if (!match) {
    return null;
  }

  const [, leading, content, trailing] = match;
  const translated = translateLegacyText(content);
  if (!translated) {
    return null;
  }

  return `${leading}${translated}${trailing}`;
}

function shouldSkipNode(node: Node) {
  const parentElement =
    node instanceof Element ? node : node.parentElement;
  if (!parentElement) {
    return true;
  }

  if (parentElement.closest("[data-i18n-skip='true']")) {
    return true;
  }

  const tagName = parentElement.tagName;
  return tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT";
}

function syncTextNode(node: Text, locale: "zh-CN" | "en") {
  if (shouldSkipNode(node)) {
    return;
  }

  const currentValue = node.textContent ?? "";
  const originalValue =
    originalTextMap.get(node)
    ?? (hasChineseText(currentValue) ? currentValue : null);

  if (!originalValue) {
    return;
  }

  if (!originalTextMap.has(node)) {
    originalTextMap.set(node, originalValue);
  }

  if (locale === "en") {
    const translated = translateDisplayValue(originalValue);
    if (translated && node.textContent !== translated) {
      node.textContent = translated;
    }
    return;
  }

  if (node.textContent !== originalValue) {
    node.textContent = originalValue;
  }
}

function syncAttributes(element: Element, locale: "zh-CN" | "en") {
  if (shouldSkipNode(element)) {
    return;
  }

  const currentStore = originalAttributeMap.get(element) ?? new Map<string, string>();
  let hasStoredAttributes = originalAttributeMap.has(element);

  for (const attributeName of ATTRIBUTE_NAMES) {
    const currentValue = element.getAttribute(attributeName);
    const originalValue =
      currentStore.get(attributeName)
      ?? (currentValue && hasChineseText(currentValue) ? currentValue : null);

    if (!originalValue) {
      continue;
    }

    if (!currentStore.has(attributeName)) {
      currentStore.set(attributeName, originalValue);
      hasStoredAttributes = true;
    }

    if (locale === "en") {
      const translated = translateDisplayValue(originalValue);
      if (translated && currentValue !== translated) {
        element.setAttribute(attributeName, translated);
      }
      continue;
    }

    if (currentValue !== originalValue) {
      element.setAttribute(attributeName, originalValue);
    }
  }

  if (hasStoredAttributes) {
    originalAttributeMap.set(element, currentStore);
  }
}

function syncNode(node: Node, locale: "zh-CN" | "en") {
  if (node.nodeType === Node.TEXT_NODE) {
    syncTextNode(node as Text, locale);
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  syncAttributes(node, locale);
  for (const childNode of node.childNodes) {
    syncNode(childNode, locale);
  }
}

export function LegacyTranslationHost() {
  const { locale } = useI18n();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.getElementById("root");
    if (!root) {
      return;
    }

    const syncTree = (node: Node) => syncNode(node, locale);
    syncTree(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target instanceof Text) {
          syncTextNode(mutation.target, locale);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          syncAttributes(mutation.target, locale);
        }

        mutation.addedNodes.forEach((node) => syncTree(node));
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTE_NAMES],
    });

    return () => {
      observer.disconnect();
    };
  }, [locale]);

  return null;
}
