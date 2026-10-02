import { IslLoader } from "@/components/isl-loader";

// Shown instantly while any page inside the app loads its data.
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <IslLoader />
    </div>
  );
}
