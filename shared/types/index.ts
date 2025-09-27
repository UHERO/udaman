import "@tanstack/react-table";

export * from "./udaman";

/** This module added to allow extending the tanstack table meta with a className property */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}
