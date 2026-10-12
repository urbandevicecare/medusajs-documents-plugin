import DocumentModuleService from "./service";
import { Module } from "@medusajs/framework/utils";

export const DOCUMENTS_MODULE = "documents";

export default Module(DOCUMENTS_MODULE, {
  service: DocumentModuleService,
});
