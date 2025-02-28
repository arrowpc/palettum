#include "image/gif.h"

GIF::Frame::Frame(const Image &img)
    : image(img)
    , colorMap(nullptr, GifFreeMapObject)
    , delay_cs(10)
    , disposal_method(0)
    , transparent_index(0)
    , has_transparency(img.hasAlpha())
    , x_offset(0)
    , y_offset(0)
    , is_interlaced(false)
    , minX(img.width())
    , minY(img.height())
    , maxX(0)
    , maxY(0)
    , hasVisiblePixels(false)
{
    indices.resize(img.width() * img.height(),
                   transparent_index);  // Default to transparent
}

GIF::Frame::Frame(const Frame &other)
    : image(other.image)
    , indices(other.indices)
    , colorMap(nullptr, GifFreeMapObject)
    , delay_cs(other.delay_cs)
    , disposal_method(other.disposal_method)
    , transparent_index(other.transparent_index)
    , has_transparency(other.has_transparency)
    , x_offset(other.x_offset)
    , y_offset(other.y_offset)
    , is_interlaced(other.is_interlaced)
    , minX(other.minX)
    , minY(other.minY)
    , maxX(other.maxX)
    , maxY(other.maxY)
    , hasVisiblePixels(other.hasVisiblePixels)
{
    if (other.colorMap)
    {
        ColorMapObject *newMap =
            GifMakeMapObject(other.colorMap->ColorCount, nullptr);
        if (!newMap)
        {
            throw std::runtime_error("Failed to create color map");
        }
        for (int i = 0; i < other.colorMap->ColorCount; i++)
        {
            newMap->Colors[i] = other.colorMap->Colors[i];
        }
        newMap->ColorCount = other.colorMap->ColorCount;
        colorMap.reset(newMap);
    }
}

void GIF::Frame::updateBounds(int x, int y, GifByteType index)
{
    if (!has_transparency || index != transparent_index)
    {
        minX = std::min(minX, x);
        minY = std::min(minY, y);
        maxX = std::max(maxX, x);
        maxY = std::max(maxY, y);
        hasVisiblePixels = true;
    }
}

void GIF::Frame::setPixel(int x, int y, const RGBA &color, GifByteType index)
{
    image.set(x, y, color);
    indices[y * image.width() + x] = index;
    updateBounds(x, y, index);
}

void GIF::Frame::setPixel(int x, int y, const RGB &color, GifByteType index)
{
    image.set(x, y, color);
    indices[y * image.width() + x] = index;
    updateBounds(x, y, index);
}

GifByteType GIF::Frame::getIndex(int x, int y) const
{
    return indices[y * image.width() + x];
}

GIF::GIF(const std::string &filename)
    : GIF(filename.c_str())
{
}

GIF::GIF(const char *filename)
    : m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
    int error = 0;
    GifFileType *gif = DGifOpenFileName(filename, &error);
    if (!gif)
    {
        throw std::runtime_error("Could not open GIF file: " +
                                 std::string(GifErrorString(error)));
    }
    parse(gif);
}

GIF::GIF(int width, int height)
    : m_width(width)
    , m_height(height)
    , m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
}

void GIF::parse(GifFileType *gif)
{
    int error = 0;
    if (DGifSlurp(gif) != GIF_OK)
    {
        DGifCloseFile(gif, &error);
        throw std::runtime_error("Could not read GIF data: " +
                                 std::string(GifErrorString(gif->Error)));
    }

    m_width = gif->SWidth;
    m_height = gif->SHeight;
    m_background_color_index = gif->SBackGroundColor;

    if (gif->SColorMap)
    {
        ColorMapObject *newMap = GifMakeMapObject(gif->SColorMap->ColorCount,
                                                  gif->SColorMap->Colors);
        if (!newMap)
        {
            DGifCloseFile(gif, &error);
            throw std::runtime_error("Failed to create global color map");
        }
        m_globalColorMap.reset(newMap);
        m_has_global_color_map = true;
    }

    for (int i = 0; i < gif->ExtensionBlockCount; i++)
    {
        ExtensionBlock *ext = &gif->ExtensionBlocks[i];
        if (ext->Function == APPLICATION_EXT_FUNC_CODE &&
            ext->ByteCount >= 11 &&
            strncmp((const char *)ext->Bytes, "NETSCAPE2.0", 11) == 0 &&
            ext[1].ByteCount >= 3)
        {
            m_loop_count = ext[1].Bytes[1] | (ext[1].Bytes[2] << 8);
            break;
        }
    }

    for (int i = 0; i < gif->ImageCount; i++)
    {
        SavedImage *savedImage = &gif->SavedImages[i];
        Image frameImage(m_width, m_height, true);
        Frame frame(frameImage);

        frame.x_offset = savedImage->ImageDesc.Left;
        frame.y_offset = savedImage->ImageDesc.Top;
        frame.is_interlaced = savedImage->ImageDesc.Interlace;
        frame.disposal_method = 0;
        frame.transparent_index = -1;
        frame.has_transparency = false;
        frame.delay_cs = 10;

        readExtensions(savedImage, frame);

        if (savedImage->ImageDesc.ColorMap)
        {
            ColorMapObject *newMap =
                GifMakeMapObject(savedImage->ImageDesc.ColorMap->ColorCount,
                                 savedImage->ImageDesc.ColorMap->Colors);
            if (!newMap)
            {
                DGifCloseFile(gif, &error);
                throw std::runtime_error("Failed to create frame color map");
            }
            frame.colorMap.reset(newMap);
        }

        ColorMapObject *colorMap =
            frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
        if (!colorMap)
        {
            DGifCloseFile(gif, &error);
            throw std::runtime_error("No color map found for frame");
        }

        for (int y = 0; y < m_height; y++)
        {
            for (int x = 0; x < m_width; x++)
            {
                if (x >= frame.x_offset &&
                    x < frame.x_offset + savedImage->ImageDesc.Width &&
                    y >= frame.y_offset &&
                    y < frame.y_offset + savedImage->ImageDesc.Height)
                {
                    int src_x = x - frame.x_offset;
                    int src_y = y - frame.y_offset;
                    int idx =
                        savedImage
                            ->RasterBits[src_y * savedImage->ImageDesc.Width +
                                         src_x];
                    if (!frame.has_transparency ||
                        idx != frame.transparent_index)
                    {
                        GifColorType &color = colorMap->Colors[idx];
                        frame.setPixel(
                            x, y, RGBA(color.Red, color.Green, color.Blue, 255),
                            idx);
                    }
                    else
                    {
                        frame.setPixel(x, y, RGBA(0, 0, 0, 0),
                                       frame.transparent_index);
                    }
                }
                else
                {
                    frame.setPixel(x, y, RGBA(0, 0, 0, 0),
                                   frame.transparent_index);
                }
            }
        }

        m_frames.push_back(std::move(frame));
    }

    DGifCloseFile(gif, &error);
}

int GIF::readFromMemory(GifFileType *gif, GifByteType *buf, int size)
{
    MemoryBuffer *memBuffer = (MemoryBuffer *)gif->UserData;
    if (memBuffer->position + size > memBuffer->length)
    {
        size = memBuffer->length - memBuffer->position;
    }
    if (size > 0)
    {
        memcpy(buf, memBuffer->data + memBuffer->position, size);
        memBuffer->position += size;
        return size;
    }
    return 0;
}

GIF::GIF(const unsigned char *buffer, int length)
    : m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
    int error = 0;
    MemoryBuffer memBuffer = {buffer, length, 0};
    GifFileType *gif = DGifOpen(&memBuffer, readFromMemory, &error);
    if (!gif)
    {
        throw std::runtime_error("Could not open GIF from memory: " +
                                 std::string(GifErrorString(error)));
    }
    parse(gif);
}

GIF &GIF::operator=(const GIF &other)
{
    if (this != &other)
    {
        GIF temp(other);

        std::swap(m_width, temp.m_width);
        std::swap(m_height, temp.m_height);
        std::swap(m_frames, temp.m_frames);
        std::swap(m_globalColorMap, temp.m_globalColorMap);
        std::swap(m_loop_count, temp.m_loop_count);
        std::swap(m_background_color_index, temp.m_background_color_index);
        std::swap(m_has_global_color_map, temp.m_has_global_color_map);
    }
    return *this;
}

GIF::GIF(const GIF &other)
    : m_width(other.m_width)
    , m_height(other.m_height)
    , m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(other.m_loop_count)
    , m_background_color_index(other.m_background_color_index)
    , m_has_global_color_map(other.m_has_global_color_map)
{
    if (other.m_globalColorMap)
    {
        ColorMapObject *newMap =
            GifMakeMapObject(other.m_globalColorMap->ColorCount, nullptr);
        if (!newMap)
        {
            throw std::runtime_error("Failed to create global color map");
        }

        for (int i = 0; i < other.m_globalColorMap->ColorCount; i++)
        {
            newMap->Colors[i] = other.m_globalColorMap->Colors[i];
        }
        newMap->ColorCount = other.m_globalColorMap->ColorCount;

        m_globalColorMap.reset(newMap);
    }

    m_frames.reserve(other.m_frames.size());
    for (const auto &frame : other.m_frames)
    {
        m_frames.push_back(frame);
    }
}

void GIF::readExtensions(SavedImage *saved_image, Frame &frame)
{
    for (int j = 0; j < saved_image->ExtensionBlockCount; j++)
    {
        ExtensionBlock *ext = &saved_image->ExtensionBlocks[j];
        if (ext->Function == GRAPHICS_EXT_FUNC_CODE && ext->ByteCount >= 4)
        {
            frame.disposal_method = (ext->Bytes[0] >> 2) & 0x07;
            frame.has_transparency = (ext->Bytes[0] & 0x01) == 1;
            frame.delay_cs = ext->Bytes[1] | (ext->Bytes[2] << 8);
            frame.transparent_index =
                frame.has_transparency ? ext->Bytes[3] : -1;
        }
    }
}

size_t GIF::frameCount() const
{
    return m_frames.size();
}

int GIF::width() const noexcept
{
    return m_width;
}
int GIF::height() const noexcept
{
    return m_height;
}

void GIF::addFrame(const Image &image, int delay_cs)
{
    if (image.width() != m_width || image.height() != m_height)
    {
        throw std::invalid_argument(
            "Frame dimensions must match GIF dimensions");
    }

    Frame frame(image);
    frame.delay_cs = delay_cs;
    m_frames.push_back(std::move(frame));
}

const GIF::Frame &GIF::getFrame(size_t index) const
{
    if (index >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }
    return m_frames[index];
}

GIF::Frame &GIF::getFrame(size_t index)
{
    if (index >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }
    return m_frames[index];
}

void GIF::setPalette(size_t frameIndex, const std::vector<RGB> &palette)
{
    if (frameIndex >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }

    Frame &frame = m_frames[frameIndex];

    ColorMapObject *newMap = GifMakeMapObject(256, nullptr);
    if (!newMap)
    {
        throw std::runtime_error("Failed to create color map");
    }

    for (size_t i = 0; i < palette.size(); i++)
    {
        newMap->Colors[i].Red = palette[i].red();
        newMap->Colors[i].Green = palette[i].green();
        newMap->Colors[i].Blue = palette[i].blue();
    }

    RGB lastColor = palette.back();
    for (size_t i = palette.size(); i < 256; i++)
    {
        newMap->Colors[i].Red = lastColor.red();
        newMap->Colors[i].Green = lastColor.green();
        newMap->Colors[i].Blue = lastColor.blue();
    }

    newMap->ColorCount = 256;

    frame.colorMap.reset(newMap);
}

void GIF::setPixel(size_t frameIndex, int x, int y, const RGBA &color)
{
    if (frameIndex >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }

    Frame &frame = m_frames[frameIndex];
    ColorMapObject *colorMap =
        frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
    if (!colorMap)
    {
        throw std::runtime_error("No color map available");
    }

    if (color.alpha() == 0)
    {
        frame.setPixel(x, y, color, frame.transparent_index);
        return;
    }

    for (int i = 0; i < colorMap->ColorCount; i++)
    {
        if (colorMap->Colors[i].Red == color.red() &&
            colorMap->Colors[i].Green == color.green() &&
            colorMap->Colors[i].Blue == color.blue())
        {
            frame.setPixel(x, y, color, i);
            return;
        }
    }

    throw std::runtime_error("Color not found in palette");
}

void GIF::setPixel(size_t frameIndex, int x, int y, const RGB &color)
{
    if (frameIndex >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }

    Frame &frame = m_frames[frameIndex];
    ColorMapObject *colorMap =
        frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
    if (!colorMap)
    {
        throw std::runtime_error("No color map available");
    }

    for (int i = 0; i < colorMap->ColorCount; i++)
    {
        if (colorMap->Colors[i].Red == color.red() &&
            colorMap->Colors[i].Green == color.green() &&
            colorMap->Colors[i].Blue == color.blue())
        {
            frame.setPixel(x, y, color, i);
            return;
        }
    }

    throw std::runtime_error("Color not found in palette");
}

bool GIF::write(const std::string &filename) const
{
    return write(filename.c_str());
}

bool GIF::write(const char *filename) const
{
    int error = 0;
    GifFileType *gif = EGifOpenFileName(filename, false, &error);
    if (!gif)
    {
        throw std::runtime_error("Failed to open file for writing: " +
                                 std::string(GifErrorString(error)));
    }

    if (EGifPutScreenDesc(gif, m_width, m_height, 8, m_background_color_index,
                          m_has_global_color_map ? m_globalColorMap.get()
                                                 : nullptr) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        throw std::runtime_error("Failed to write screen descriptor: " +
                                 std::string(GifErrorString(gif->Error)));
    }

    unsigned char nsle[3] = {1, 0, 0};
    if (EGifPutExtensionLeader(gif, APPLICATION_EXT_FUNC_CODE) != GIF_OK ||
        EGifPutExtensionBlock(gif, 11, "NETSCAPE2.0") != GIF_OK ||
        EGifPutExtensionBlock(gif, 3, nsle) != GIF_OK ||
        EGifPutExtensionTrailer(gif) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        throw std::runtime_error("Failed to write loop extension: " +
                                 std::string(GifErrorString(gif->Error)));
    }

    for (const auto &frame : m_frames)
    {
        unsigned char extension[4];
        extension[0] = (frame.disposal_method & 0x07) << 2;
        if (frame.has_transparency)
        {
            extension[0] |= 0x01;
        }
        extension[1] = frame.delay_cs & 0xFF;
        extension[2] = (frame.delay_cs >> 8) & 0xFF;
        extension[3] = frame.transparent_index;

        if (EGifPutExtension(gif, GRAPHICS_EXT_FUNC_CODE, 4, extension) !=
            GIF_OK)
        {
            EGifCloseFile(gif, &error);
            throw std::runtime_error("Failed to write graphic extension: " +
                                     std::string(GifErrorString(gif->Error)));
        }

        int frameMinX = frame.hasVisiblePixels ? frame.minX : 0;
        int frameMinY = frame.hasVisiblePixels ? frame.minY : 0;
        int frameMaxX = frame.hasVisiblePixels ? frame.maxX : 1;
        int frameMaxY = frame.hasVisiblePixels ? frame.maxY : 1;

        int frameWidth = frameMaxX - frameMinX + 1;
        int frameHeight = frameMaxY - frameMinY + 1;

        if (EGifPutImageDesc(gif, frameMinX, frameMinY, frameWidth, frameHeight,
                             frame.is_interlaced,
                             frame.colorMap.get()) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            throw std::runtime_error("Failed to write image descriptor: " +
                                     std::string(GifErrorString(gif->Error)));
        }

        std::vector<GifByteType> line(frameWidth);
        for (int y = frameMinY; y <= frameMaxY; y++)
        {
            for (int x = frameMinX; x <= frameMaxX; x++)
            {
                line[x - frameMinX] =
                    frame.indices[y * frame.image.width() + x];
            }
            if (EGifPutLine(gif, line.data(), frameWidth) != GIF_OK)
            {
                EGifCloseFile(gif, &error);
                throw std::runtime_error(
                    "Failed to write image line: " +
                    std::string(GifErrorString(gif->Error)));
            }
        }
    }

    if (EGifCloseFile(gif, &error) != GIF_OK)
    {
        throw std::runtime_error("Failed to close GIF file: " +
                                 std::string(GifErrorString(error)));
    }
    return true;
}

std::vector<unsigned char> GIF::write() const
{
    int error = 0;
    GifFileType *gif = EGifOpen(
        nullptr,
        [](GifFileType *gif, const GifByteType *data, int len) -> int {
            auto vec = static_cast<std::vector<unsigned char> *>(gif->UserData);
            vec->insert(vec->end(), data, data + len);
            return len;
        },
        &error);
    if (!gif)
    {
        throw std::runtime_error("Failed to open memory buffer for writing: " +
                                 std::string(GifErrorString(error)));
    }

    std::vector<unsigned char> result;
    gif->UserData = &result;

    if (EGifPutScreenDesc(gif, m_width, m_height, 8, m_background_color_index,
                          m_has_global_color_map ? m_globalColorMap.get()
                                                 : nullptr) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        throw std::runtime_error("Failed to write screen descriptor: " +
                                 std::string(GifErrorString(gif->Error)));
    }

    unsigned char nsle[3] = {1, 0, 0};
    if (EGifPutExtensionLeader(gif, APPLICATION_EXT_FUNC_CODE) != GIF_OK ||
        EGifPutExtensionBlock(gif, 11, "NETSCAPE2.0") != GIF_OK ||
        EGifPutExtensionBlock(gif, 3, nsle) != GIF_OK ||
        EGifPutExtensionTrailer(gif) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        throw std::runtime_error("Failed to write loop extension: " +
                                 std::string(GifErrorString(gif->Error)));
    }

    std::vector<GifByteType> currentIndices(m_width * m_height,
                                            m_background_color_index);

    for (const auto &frame : m_frames)
    {
        std::vector<GifByteType> nextIndices = currentIndices;

        int frameMinX = frame.hasVisiblePixels ? frame.minX : 0;
        int frameMinY = frame.hasVisiblePixels ? frame.minY : 0;
        int frameMaxX = frame.hasVisiblePixels ? frame.maxX : 1;
        int frameMaxY = frame.hasVisiblePixels ? frame.maxY : 1;

        bool hasChanges = false;
        for (int y = frameMinY; y <= frameMaxY; y++)
        {
            for (int x = frameMinX; x <= frameMaxX; x++)
            {
                GifByteType newIndex = frame.indices[y * m_width + x];
                if (newIndex != currentIndices[y * m_width + x])
                {
                    hasChanges = true;
                    nextIndices[y * m_width + x] = newIndex;
                }
            }
        }

        if (!hasChanges)
        {
            frameMinX = frameMinY = 0;
            frameMaxX = frameMaxY = 1;
        }

        frameMinX = std::max(0, frameMinX - 1);
        frameMinY = std::max(0, frameMinY - 1);
        frameMaxX = std::min(m_width - 1, frameMaxX + 1);
        frameMaxY = std::min(m_height - 1, frameMaxY + 1);

        int frameWidth = frameMaxX - frameMinX + 1;
        int frameHeight = frameMaxY - frameMinY + 1;

        unsigned char extension[4];
        extension[0] = (frame.disposal_method & 0x07) << 2;
        if (frame.has_transparency)
        {
            extension[0] |= 0x01;
        }
        extension[1] = frame.delay_cs & 0xFF;
        extension[2] = (frame.delay_cs >> 8) & 0xFF;
        extension[3] = frame.transparent_index;

        if (EGifPutExtension(gif, GRAPHICS_EXT_FUNC_CODE, 4, extension) !=
            GIF_OK)
        {
            EGifCloseFile(gif, &error);
            throw std::runtime_error("Failed to write graphic extension: " +
                                     std::string(GifErrorString(gif->Error)));
        }

        if (EGifPutImageDesc(gif, frameMinX, frameMinY, frameWidth, frameHeight,
                             frame.is_interlaced,
                             frame.colorMap.get()) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            throw std::runtime_error("Failed to write image descriptor: " +
                                     std::string(GifErrorString(gif->Error)));
        }

        std::vector<GifByteType> rasterBits(frameWidth);
        for (int y = frameMinY; y < frameMinY + frameHeight; y++)
        {
            for (int x = frameMinX; x < frameMinX + frameWidth; x++)
            {
                rasterBits[x - frameMinX] = nextIndices[y * m_width + x];
            }
            if (EGifPutLine(gif, rasterBits.data(), frameWidth) != GIF_OK)
            {
                EGifCloseFile(gif, &error);
                throw std::runtime_error(
                    "Failed to write image line: " +
                    std::string(GifErrorString(gif->Error)));
            }
        }

        if (frame.disposal_method == DISPOSE_DO_NOT)
        {
            currentIndices = std::move(nextIndices);
        }
        else if (frame.disposal_method == DISPOSE_BACKGROUND)
        {
            for (int y = frameMinY; y < frameMinY + frameHeight; y++)
            {
                for (int x = frameMinX; x < frameMinX + frameWidth; x++)
                {
                    currentIndices[y * m_width + x] = m_background_color_index;
                }
            }
        }
    }

    if (EGifCloseFile(gif, &error) != GIF_OK)
    {
        throw std::runtime_error("Failed to close GIF buffer: " +
                                 std::string(GifErrorString(error)));
    }
    return result;
}

bool GIF::resize(int width, int height)
{
    if (width <= 0 || height <= 0)
    {
        return false;
    }

    double x_ratio = static_cast<double>(m_width) / width;
    double y_ratio = static_cast<double>(m_height) / height;

    for (Frame &frame : m_frames)
    {
        if (!frame.image.resize(width, height))
        {
            return false;
        }

        std::vector<GifByteType> new_indices(width * height);

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int src_x = static_cast<int>(x * x_ratio);
                int src_y = static_cast<int>(y * y_ratio);
                new_indices[y * width + x] =
                    frame.indices[src_y * m_width + src_x];
            }
        }

        frame.indices = std::move(new_indices);
    }

    m_width = width;
    m_height = height;
    return true;
}
