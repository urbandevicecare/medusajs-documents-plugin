import { model } from "@medusajs/framework/utils";

export const DocumentLink = model.define("document_link", {
  id: model.id().primaryKey(),
  shortcode: model.text().unique(),
  url: model.text(),
  metadata: model.json().nullable(),
});

export default DocumentLink;
