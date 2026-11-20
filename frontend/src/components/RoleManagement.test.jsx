import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RoleManagement from './RoleManagement';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const result = data => ({ ok: true, json: async () => data });

it('lets admin create a role and refreshes the assignment options', async () => {
  const created = { id: 'new-role', name: 'manager', description: 'อ่านข้อมูล', level: 0, is_active: 1 };
  const fetchMock = vi.fn().mockResolvedValueOnce(result({ success: true, data: [] }))
    .mockResolvedValueOnce(result({ success: true, data: created }))
    .mockResolvedValueOnce(result({ success: true, data: [created] }));
  vi.stubGlobal('fetch', fetchMock);
  const onRolesChanged = vi.fn();
  render(<RoleManagement currentUser={{ role: 'admin' }} onRolesChanged={onRolesChanged} />);
  fireEvent.click(await screen.findByRole('button', { name: 'เพิ่ม Role' }));
  fireEvent.change(screen.getByLabelText(/ชื่อสิทธิ์/), { target: { value: 'manager' } });
  fireEvent.change(screen.getByLabelText('คำอธิบาย'), { target: { value: 'อ่านข้อมูล' } });
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
  expect(await screen.findByText('manager')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/roles', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ name: 'manager', description: 'อ่านข้อมูล', level: 0 }) }));
  await waitFor(() => expect(onRolesChanged).toHaveBeenCalled());
});

it('does not offer role creation to a regional administrator', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(result({ success: true, data: [] })));
  render(<RoleManagement currentUser={{ role: 'RegAdmin' }} />);
  await screen.findByText('จัดการระดับสิทธิ์การเข้าถึง (Roles)');
  expect(screen.queryByRole('button', { name: 'เพิ่ม Role' })).not.toBeInTheDocument();
});

it('keeps the form and its contents when the role name already exists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(result({ success: true, data: [] }))
    .mockResolvedValueOnce(result({ success: false, error: 'มีชื่อ Role นี้ในระบบแล้ว' })));
  render(<RoleManagement currentUser={{ role: 'admin' }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'เพิ่ม Role' }));
  fireEvent.change(screen.getByLabelText(/ชื่อสิทธิ์/), { target: { value: 'manager' } });
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('มีชื่อ Role นี้ในระบบแล้ว');
  expect(screen.getByLabelText(/ชื่อสิทธิ์/)).toHaveValue('manager');
});
