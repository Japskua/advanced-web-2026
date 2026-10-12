import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { UserDto } from "@shared/types";
import { deleteUser, fetchUsers } from "../api";
import { useAuth } from "../hooks/useAuth";

export default function AdminUsersPage() {
  const { userId: myId } = useAuth();

  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The user waiting for confirmation in the dialog (null = dialog closed).
  const [userToDelete, setUserToDelete] = useState<UserDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchUsers(controller.signal)
      .then(setUsers)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load users");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function confirmDelete() {
    if (!userToDelete) return;
    setDeleting(true);
    setError("");

    try {
      await deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id));
      setUserToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the user");
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          Users
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      size="small"
                      color={user.role === "admin" ? "secondary" : "default"}
                    />
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      onClick={() => setUserToDelete(user)}
                      // The API refuses this too; disabling the button explains it earlier.
                      disabled={user.id === myId}
                      title={user.id === myId ? "You cannot delete your own account" : undefined}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* A confirmation dialog: MUI renders it on top of the page while open. */}
      <Dialog open={userToDelete !== null} onClose={() => !deleting && setUserToDelete(null)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {userToDelete?.email} and all notifications they wrote will be deleted. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserToDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
