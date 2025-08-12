export function portal(node: HTMLElement, target: HTMLElement | string = document.body) {
  let targetEl: HTMLElement | null;
  if (typeof target === 'string') {
    targetEl = document.querySelector(target);
  } else {
    targetEl = target;
  }
  if (!targetEl) targetEl = document.body;

  const placeholder = document.createComment('svelte-portal');
  const parent = node.parentNode as Node | null;
  if (parent) parent.insertBefore(placeholder, node);
  targetEl.appendChild(node);

  return {
    destroy() {
      try {
        // Remove from current parent first to avoid insertBefore errors
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch {}

      // Only restore if placeholder still lives under the original parent
      if (parent && (placeholder.parentNode === parent)) {
        try {
          (parent as HTMLElement).insertBefore(node, placeholder);
          parent.removeChild(placeholder);
        } catch {
          // Fallback: ensure placeholder cleanup
          try { placeholder.parentNode && placeholder.parentNode.removeChild(placeholder); } catch {}
        }
      } else {
        // If placeholder is gone or parent changed, just try to clean it up
        try { placeholder.parentNode && placeholder.parentNode.removeChild(placeholder); } catch {}
        // If we still have an original parent, append back for good measure
        try { if (parent && (parent as HTMLElement).contains(placeholder) === false) (parent as HTMLElement).appendChild(node); } catch {}
      }
    }
  };
}
