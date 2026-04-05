import { useState, useEffect } from "react";
import { Search, Edit, Trash2, Shield } from "lucide-react";
import { Button } from "../../components/Button";
import { userService } from "../../../services/userService";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    userService.getUsers().then((res) => setUsers(res.data.users)).finally(() => setIsLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await userService.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u._id !== id));
  };

  const handleRoleChange = async (user: User, role: string) => {
    await userService.updateUser(user._id, { role });
    setUsers((prev) => prev.map((u) => u._id === user._id ? { ...u, role } : u));
    setEditingUser(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage customer accounts and permissions</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium">User</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Email</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Role</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Join Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                        user.role === "admin"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {user.role === "admin" && <Shield className="w-3 h-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                        onClick={() => setEditingUser(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                        onClick={() => handleDelete(user._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="text-3xl font-bold mb-1">{users.length}</div>
          <div className="text-sm text-muted-foreground">Total Users</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="text-3xl font-bold mb-1">
            {users.filter((u) => u.role === "admin").length}
          </div>
          <div className="text-sm text-muted-foreground">Administrators</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="text-3xl font-bold mb-1">
            {users.filter((u) => u.isActive).length}
          </div>
          <div className="text-sm text-muted-foreground">Active Users</div>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Change Role</h2>
            <p className="text-muted-foreground">Change role for <strong>{editingUser.name}</strong></p>
            <div className="flex gap-4">
              <Button variant={editingUser.role === "user" ? "primary" : "outline"} className="flex-1" onClick={() => handleRoleChange(editingUser, "user")}>User</Button>
              <Button variant={editingUser.role === "admin" ? "primary" : "outline"} className="flex-1" onClick={() => handleRoleChange(editingUser, "admin")}>Admin</Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setEditingUser(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}


