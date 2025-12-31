export const getUploadUrl = /* GraphQL */ `
  mutation GetUploadUrl($fileName: String!, $contentType: String!) {
    getUploadUrl(fileName: $fileName, contentType: $contentType) {
      url
      fileName
    }
  }
`;
