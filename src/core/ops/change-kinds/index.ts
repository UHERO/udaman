/**
 * Loads every change kind into the registry. Import this (not the
 * individual files) wherever the registry is read. A new domain adds its
 * module here.
 */
import "./loaders";
import "./metadata";

export {
  getChangeKind,
  listChangeKinds,
  type ChangeKind,
} from "../change-registry";
