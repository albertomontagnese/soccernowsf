import { getPaymentsCollection } from "../../helpers/firestoreClient";

export default async function deleteUser(req, res) {
  try {
    const { id } = req.body;

    if (!id) {
      res.status(400).json({ message: "ID is required for deletion." });
      return;
    }

    try {
      const paymentsRef = getPaymentsCollection();
      await paymentsRef.doc(id.toString()).delete();
      console.log(`Record ${id} deleted successfully`);
      res
        .status(200)
        .json({ message: "Record deleted successfully", data: { id } });
    } catch (err) {
      console.log("Error", err.stack);
      res.status(500).json({ message: "Error deleting data", error: err });
    }
  } catch (err) {
    console.log("Error", err.stack);
    res.status(500).json({ message: "Internal server error", error: err });
  }
}
