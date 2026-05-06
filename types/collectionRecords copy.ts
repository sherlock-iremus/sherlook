interface RawRecord {
  id: number;
  fields: {
    Collection: string;
    Nom: string;
    MD5: string;
    Pages: number | null;
    Type: string;
  };
}