/**
 * @param {string[]} filenames
 * @returns {string[]}
 */
function formatFrontendFiles(filenames) {
  // Convert absolute paths to paths relative to frontend/
  const relativePaths = filenames.map(f => f.replace(/^.*\/frontend\//, ''));

  return [
    `cd frontend && npx eslint --max-warnings 0 --fix --cache ${relativePaths.join(' ')}`,
    `cd frontend && npx prettier --write ${relativePaths.join(' ')}`,
  ];
}

export default {
  'frontend/**/*.{ts,tsx}': formatFrontendFiles,
};
