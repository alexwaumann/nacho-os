import { describe, expect, it } from "vitest";

import { hasPdfHeader, isInboxFile, parseOpenedFileUrl } from "./openedFile";

const INBOX =
  "file:///private/var/mobile/Containers/Data/Application/0F3A/tmp/com.waumann.nachoos.native-Inbox/Work%20order%205521.pdf";
const OLD_INBOX = "file:///var/mobile/Containers/Data/Application/0F3A/Documents/Inbox/WO.pdf";

describe("parseOpenedFileUrl", () => {
  it("reads the name of a PDF iOS copied into the Inbox", () => {
    expect(parseOpenedFileUrl(INBOX)).toEqual({
      uri: INBOX,
      name: "Work order 5521.pdf",
      isPdf: true,
    });
  });

  it("knows a PDF by its extension in any case", () => {
    expect(parseOpenedFileUrl("file:///Inbox/SCAN.PDF")?.isPdf).toBe(true);
    expect(parseOpenedFileUrl("FILE:///Inbox/scan.Pdf")?.isPdf).toBe(true);
  });

  it("flags other files as not PDFs", () => {
    expect(parseOpenedFileUrl("file:///Documents/Inbox/photo.jpg")).toMatchObject({
      name: "photo.jpg",
      isPdf: false,
    });
    expect(parseOpenedFileUrl("file:///Documents/Inbox/notes")?.isPdf).toBe(false);
  });

  it("ignores ordinary app links", () => {
    expect(parseOpenedFileUrl("nachoos://job/abc")).toBeNull();
    expect(parseOpenedFileUrl("nachoos:///?voiceClip=http%3A%2F%2Flocalhost%2Fa.m4a")).toBeNull();
    expect(parseOpenedFileUrl("https://nacho-os.netlify.app/jobs")).toBeNull();
    expect(parseOpenedFileUrl("/add-job")).toBeNull();
  });

  it("ignores a file URL without a file name", () => {
    expect(parseOpenedFileUrl("file:///")).toBeNull();
  });

  it("drops a query or fragment from the name", () => {
    expect(parseOpenedFileUrl("file:///Inbox/a.pdf?x=1#page=2")?.name).toBe("a.pdf");
  });

  it("keeps a name that isn't valid percent-encoding as it is", () => {
    expect(parseOpenedFileUrl("file:///Inbox/100%.pdf")?.name).toBe("100%.pdf");
  });
});

describe("isInboxFile", () => {
  it("is true only for files directly in the app's inbox", () => {
    expect(isInboxFile(INBOX)).toBe(true);
    expect(isInboxFile(OLD_INBOX)).toBe(true);
    expect(isInboxFile("file:///var/tmp/com.waumann.nachoos.native-Inbox/sub/a.pdf")).toBe(false);
    expect(isInboxFile("file:///var/Library/Caches/a.pdf")).toBe(false);
    expect(isInboxFile("file:///var/Documents/Inbox/")).toBe(false);
  });
});

describe("hasPdfHeader", () => {
  const bytes = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

  it("finds the PDF marker at the start", () => {
    expect(hasPdfHeader(bytes("%PDF-1.7\n%âãÏÓ"))).toBe(true);
  });

  it("allows a few bytes before the marker", () => {
    expect(hasPdfHeader(bytes("\n\r  %PDF-1.4"))).toBe(true);
  });

  it("rejects other files", () => {
    expect(hasPdfHeader(bytes("<html><body>Work order</body></html>"))).toBe(false);
    expect(hasPdfHeader([0xff, 0xd8, 0xff, 0xe0])).toBe(false); // JPEG
    expect(hasPdfHeader([])).toBe(false);
    expect(hasPdfHeader(bytes("%PDF"))).toBe(false);
  });

  it("only looks at the first 1024 bytes", () => {
    expect(hasPdfHeader(bytes(`${" ".repeat(1100)}%PDF-1.4`))).toBe(false);
  });
});
