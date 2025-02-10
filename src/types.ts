export type BaseApiModel = {
  id: number;
  documentId: string;
  createdAt: string;
  updatedatedAt?: string | null | undefined;
  publishedAt?: string | null | undefined;
};

export type MediaType = {
  name: string;
  url: string;
  hash: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  formats: {
    thumbnail: Omit<MediaType, "formats">;
    xsmall: Omit<MediaType, "formats">;
    small: Omit<MediaType, "formats">;
    medium: Omit<MediaType, "formats">;
    large: Omit<MediaType, "formats">;
    xlarge: Omit<MediaType, "formats">;
  };
} & BaseApiModel;

export type DestinationType = {
  country: string;
  city?: string | null;
  category1: string;
  category2: string;
  image?: Pick<MediaType, "documentId" | "id" | "url">;
} & BaseApiModel;
