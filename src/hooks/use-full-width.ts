import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "udaman-full-width";
const EVENT_NAME = "udaman-width-change";

export function useFullWidth() {
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");

    const handleChange = () => {
      setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");
    };
    window.addEventListener(EVENT_NAME, handleChange);
    return () => window.removeEventListener(EVENT_NAME, handleChange);
  }, []);

  const toggleWidth = useCallback(() => {
    const next = !fullWidth;
    setFullWidth(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [fullWidth]);

  return { fullWidth, toggleWidth };
}
