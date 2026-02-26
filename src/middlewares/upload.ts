import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import multer from "multer";

const storage = new CloudinaryStorage({
    cloudinary,
    params : async () => {
        return {
            folder: 'careXpert_profile_pictures',
            allowed_formats: ['jpg', 'jpeg', 'png'],
            transformation: [{ width: 500, height: 500, crop: 'limit' }],
        }
    }
});

const storage2 = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
        folder: 'careXpert_reports',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    })
});

const upload = multer({ storage });
const upload2 = multer({storage:storage2});

export { upload, upload2 };
