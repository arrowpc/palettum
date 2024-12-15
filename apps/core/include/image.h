#ifndef IMAGE_H
#define IMAGE_H

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include <gif_lib.h>
#include <memory>
#include <vector>
#include "color.h"

class Image
{
public:
    explicit Image() = default;
    explicit Image(const unsigned char *buffer, int length);
    explicit Image(const std::string &filename);
    explicit Image(const char *filename);
    explicit Image(int width, int height);
    Image(const Image &) = default;
    Image &operator=(const Image &) = default;
    int operator-(const Image &other) const;

    [[nodiscard]] std::vector<unsigned char> write() const;
    [[nodiscard]] bool write(const std::string &filename) const;
    bool write(const char *filename) const;

    bool resize(int width, int height);
    [[nodiscard]] RGB get(int x, int y) const;
    void set(int x, int y, const RGB &RGB);
    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;
    [[nodiscard]] int channels() const noexcept;
    [[nodiscard]] int size() const noexcept;
    [[nodiscard]] const uint8_t *data() const noexcept;
    bool operator==(const Image &other) const;
    bool operator!=(const Image &other) const;

private:
    void validateCoordinates(int x, int y) const;
    int m_width{0}, m_height{0}, m_channels{3};
    std::vector<uint8_t> m_data;
};

class GIF
{
public:
    struct Frame {
        Image image;
        std::vector<GifByteType> indices;
        std::unique_ptr<ColorMapObject, void (*)(ColorMapObject *)> colorMap;
        int delay_cs;

        int disposal_method{};
        int transparent_index{};
        bool has_transparency{};
        int y_offset{};
        int x_offset{};
        bool is_interlaced{};

        explicit Frame(const Image &img);
        Frame(const Frame &other);
        Frame(Frame &&) noexcept = default;

        void setPixel(int x, int y, const RGB &color, GifByteType index);
        [[nodiscard]] GifByteType getIndex(int x, int y) const;
        GifByteType findOrAddColor(const RGB &color);
    };

    explicit GIF(const std::string &filename);
    explicit GIF(const char *filename);
    explicit GIF(int width, int height);
    ~GIF() = default;

    GIF &operator=(const GIF &other);
    GIF(const GIF &other);
    GIF(GIF &&) noexcept = default;

    void setPalette(size_t frameIndex, const std::vector<RGB> &palette);
    void setPixel(size_t frameIndex, int x, int y, const RGB &color);
    [[nodiscard]] size_t frameCount() const;
    void addFrame(const Image &image, int delay_cs = 10);
    [[nodiscard]] const Frame &getFrame(size_t index) const;
    Frame &getFrame(size_t index);
    bool write(const char *filename) const;
    [[nodiscard]] bool write(const std::string &filename) const;
    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;

private:
    std::vector<Frame> m_frames;
    std::unique_ptr<ColorMapObject, void (*)(ColorMapObject *)>
        m_globalColorMap;
    int m_width;
    int m_height;

    int m_loop_count;  // 0 = infinite, -1 = no loop, else specific count
    int m_background_color_index;
    bool m_has_global_color_map;

    static void readExtensions(SavedImage *saved_image, Frame &frame);
};

#endif  //IMAGE_H
