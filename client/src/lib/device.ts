export const getSavedDeviceName = () => localStorage.getItem('nz_device_name') ?? '';

export const saveDeviceName = (name: string) => localStorage.setItem('nz_device_name', name);

export const defaultDeviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'My iOS Device';
  if (/Windows/i.test(ua)) return 'My Windows PC';
  return 'My Device';
};
