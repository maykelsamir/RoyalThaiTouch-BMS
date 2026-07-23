import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

const emptyUser = { username: '', password: '', full_name: '', email: '', phone: '', role: '', allowed_branch_ids: [], active: true }

export default function UserManagementPage({ initialTab = 'users' }) {
  const [tab, setTab] = useState(initialTab)
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [branches, setBranches] = useState([])
  const [catalog, setCatalog] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState(emptyUser)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setError('')
    try {
      const [userData, roleData, branchData, permissionData] = await Promise.all([
        api('/admin/users'), api('/admin/roles'), api('/admin/branches'), api('/admin/permission-catalog'),
      ])
      setUsers(userData); setRoles(roleData); setBranches(branchData); setCatalog(permissionData)
      if (!userForm.role && roleData.length) setUserForm((current) => ({ ...current, role: roleData[0].name }))
    } catch (requestError) { setError(requestError.message) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const permissionCount = useMemo(() => catalog.reduce((sum, group) => sum + group.items.length, 0), [catalog])

  function resetUser() {
    setEditingUser(null)
    setUserForm({ ...emptyUser, role: roles[0]?.name || '' })
  }

  function editUser(item) {
    setEditingUser(item)
    setUserForm({ username: item.username, password: '', full_name: item.full_name, email: item.email, phone: item.phone, role: item.role, allowed_branch_ids: item.allowed_branch_ids, active: item.active })
  }

  async function saveUser(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const body = { full_name: userForm.full_name, email: userForm.email, phone: userForm.phone, role: userForm.role, allowed_branch_ids: userForm.allowed_branch_ids, active: userForm.active }
      if (editingUser) await api(`/admin/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/admin/users', { method: 'POST', body: JSON.stringify({ ...body, username: userForm.username, password: userForm.password }) })
      setMessage(editingUser ? 'User updated successfully.' : 'User created successfully.')
      resetUser(); await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function resetPassword(item) {
    const password = window.prompt(`New password for ${item.username}`)
    if (!password) return
    try { await api(`/admin/users/${item.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }); setMessage('Password reset successfully.') }
    catch (requestError) { setError(requestError.message) }
  }

  async function removeUser(item) {
    if (!window.confirm(`Delete user ${item.username}?`)) return
    try { await api(`/admin/users/${item.id}`, { method: 'DELETE' }); setMessage('User deleted.'); await load() }
    catch (requestError) { setError(requestError.message) }
  }

  function toggleBranch(id) {
    setUserForm((current) => ({ ...current, allowed_branch_ids: current.allowed_branch_ids.includes(id) ? current.allowed_branch_ids.filter((value) => value !== id) : [...current.allowed_branch_ids, id] }))
  }

  function editRole(item) { setEditingRole(item); setRoleForm({ name: item.name, permissions: [...item.permissions] }) }
  function resetRole() { setEditingRole(null); setRoleForm({ name: '', permissions: [] }) }
  function togglePermission(permission) {
    setRoleForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((value) => value !== permission) : [...current.permissions, permission] }))
  }

  async function saveRole(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (editingRole) await api(`/admin/roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(roleForm) })
      else await api('/admin/roles', { method: 'POST', body: JSON.stringify(roleForm) })
      setMessage(editingRole ? 'Role updated successfully.' : 'Role created successfully.')
      resetRole(); await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function removeRole(item) {
    if (!window.confirm(`Delete role ${item.name}?`)) return
    try { await api(`/admin/roles/${item.id}`, { method: 'DELETE' }); setMessage('Role deleted.'); await load() }
    catch (requestError) { setError(requestError.message) }
  }

  return <>
    <div className="pageTitleRow"><div><span className="eyebrow">Access Control</span><h2>User & Permission Management</h2><p>Manage accounts, roles, permissions, branch access, and account status.</p></div><div className="adminTabs"><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button><button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Roles & Permissions</button></div></div>
    {error && <div className="alert">{error}</div>}{message && <div className="successAlert">{message}</div>}

    {tab === 'users' && <div className="adminLayout">
      <form className="adminForm" onSubmit={saveUser}>
        <div className="panelHeading"><span className="eyebrow">{editingUser ? 'Edit account' : 'New account'}</span><h3>{editingUser ? editingUser.username : 'Create User'}</h3></div>
        {!editingUser && <label>Username<input required minLength="3" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} /></label>}
        {!editingUser && <label>Password<input required type="password" minLength="8" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></label>}
        <label>Full name<input value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} /></label>
        <label>Email<input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label>
        <label>Phone<input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} /></label>
        <label>Role<select required value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>{roles.map((role) => <option key={role.id}>{role.name}</option>)}</select></label>
        <div className="branchChecks"><span>Allowed centers <small>Leave all unchecked for all centers</small></span>{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={userForm.allowed_branch_ids.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />{branch.name}</label>)}</div>
        <label className="switchRow"><input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} /> Active account</label>
        <div className="formActions"><button type="button" className="secondaryButton" onClick={resetUser}>Clear</button><button className="primaryButton" disabled={busy}>{busy ? 'Saving…' : 'Save User'}</button></div>
      </form>
      <section className="adminTablePanel"><div className="panelHeading"><span className="eyebrow">Accounts</span><h3>{users.length} Users</h3></div><div className="responsiveTable"><table><thead><tr><th>User</th><th>Role</th><th>Centers</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><strong>{item.full_name || item.username}</strong><span>@{item.username}<br />{item.email || item.phone}</span></td><td>{item.role}</td><td>{item.allowed_branch_ids.length ? item.allowed_branch_ids.map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(', ') : 'All centers'}</td><td><span className={`statusBadge ${item.active ? 'status-approved' : 'status-rejected'}`}>{item.active ? 'Active' : 'Disabled'}</span></td><td>{item.last_login_at ? new Date(item.last_login_at).toLocaleString() : 'Never'}</td><td><div className="tableActions"><button onClick={() => editUser(item)}>Edit</button><button onClick={() => resetPassword(item)}>Password</button><button className="dangerText" onClick={() => removeUser(item)}>Delete</button></div></td></tr>)}</tbody></table></div></section>
    </div>}

    {tab === 'roles' && <div className="adminLayout">
      <form className="adminForm roleEditor" onSubmit={saveRole}><div className="panelHeading"><span className="eyebrow">Role profile</span><h3>{editingRole ? `Edit ${editingRole.name}` : 'Create Role'}</h3></div><label>Role name<input required value={roleForm.name} disabled={editingRole?.protected} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} /></label><div className="permissionGroups">{catalog.map((group) => <section key={group.group}><h4>{group.group}</h4>{group.items.map((permission) => <label key={permission}><input type="checkbox" checked={roleForm.permissions.includes(permission)} disabled={editingRole?.protected} onChange={() => togglePermission(permission)} /><span>{permission.split('.').slice(1).join(' ').replaceAll('_', ' ')}</span></label>)}</section>)}</div><div className="formActions"><button type="button" className="secondaryButton" onClick={resetRole}>Clear</button><button className="primaryButton" disabled={busy || editingRole?.protected}>{busy ? 'Saving…' : 'Save Role'}</button></div></form>
      <section className="roleListPanel"><div className="panelHeading"><span className="eyebrow">Role library</span><h3>{roles.length} Roles · {permissionCount} Permissions</h3></div><div className="roleCards">{roles.map((item) => <article key={item.id}><div><h4>{item.name}</h4><p>{item.permissions.length} permissions {item.protected ? '· Protected' : ''}</p></div><div className="tableActions"><button onClick={() => editRole(item)}>View / Edit</button>{!item.protected && <button className="dangerText" onClick={() => removeRole(item)}>Delete</button>}</div></article>)}</div></section>
    </div>}
  </>
}
