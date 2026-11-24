import React from 'react';
import { imageStore, isImageRef } from './imageStore';

/** URL affichable d'une image des données (référence `img:…`, data URL ou URL blob). */
export const imageUrl = (src: string | null | undefined): string | null =>
    !src ? null : isImageRef(src) ? imageStore.url(src) : src;

type StoredImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | null | undefined };

/** Remplace `<img>` pour toute image des données : le navigateur la charge à la demande. */
const StoredImage: React.FC<StoredImageProps> = ({ src, alt = '', ...rest }) => {
    const url = imageUrl(src);
    return url ? <img src={url} alt={alt} {...rest} /> : null;
};

export default StoredImage;
