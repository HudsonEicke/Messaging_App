// for image URLs people paste in; blocks javascript:, data: and the like
export const isWebUrl = (value: string): boolean => URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol);
