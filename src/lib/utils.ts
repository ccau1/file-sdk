export const getFileExtension = (fileName: string) => {
  const fileNameParts = fileName.split('.');
  // if fileNameParts has 2 or more
  if (fileNameParts.length >= 2) {
    // take the last element in the array as ext
    return fileNameParts.pop();
  }
  return '';
};

export const getFileName = (fileName: string) => {
  const fileNameParts = fileName.split('.');
  // if fileNameParts has 2 or more
  if (fileNameParts.length >= 2) {
    // take the last element out in the array as ext
    fileNameParts.pop();
  }
  // take the rest of the parts as fileName
  return fileNameParts.join('.');
};
