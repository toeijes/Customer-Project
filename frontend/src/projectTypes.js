export const PROJECT_TYPES = Object.freeze({
  1: 'โครงการขยายเขตฯ (เงินรายได้)',
  2: 'โครงการขยายเขตฯ (เงินอุดหนุน)',
  3: 'โครงการขยายเขตฯ (กระตุ้นเศรษฐกิจ)',
  4: 'โครงการวางท่อเข้าซอย',
  5: 'งบประปาอาคาร(เพิ่มผู้ใช้น้ำ)'
});

export const PROJECT_TYPE_OPTIONS = Object.entries(PROJECT_TYPES).map(([value, label]) => ({ value, label }));

export const selectedProjectTypes = value => value === 'all'
  ? PROJECT_TYPE_OPTIONS.map(option => option.value)
  : String(value).split(',').filter(type => PROJECT_TYPES[type]);

export const matchesProjectType = (selection, projectType) =>
  selectedProjectTypes(selection).includes(String(projectType));
