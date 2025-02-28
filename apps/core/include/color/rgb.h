#pragma once

#include <iostream>
#include <optional>
#include <vector>
#include "color/lab.h"

class Lab;

struct XYZ {
    float X{0}, Y{0}, Z{0};

    static constexpr float WHITE_X = 95.047f;
    static constexpr float WHITE_Y = 100.000;
    static constexpr float WHITE_Z = 108.883;
    static constexpr float EPSILON = 0.008856;
    static constexpr float KAPPA = 903.3;
};

class RGB
{
public:
    explicit RGB(unsigned char r = 0, unsigned char g = 0,
                 unsigned char b = 0) noexcept;
    [[nodiscard]] Lab toLab() const noexcept;
    RGB(std::initializer_list<unsigned char> il) noexcept
    {
        auto it = il.begin();
        m_r = it != il.end() ? *it++ : 0;
        m_g = it != il.end() ? *it++ : 0;
        m_b = it != il.end() ? *it : 0;
    }
    bool operator==(const RGB &rhs) const noexcept;
    [[nodiscard]] constexpr unsigned char red() const noexcept
    {
        return m_r;
    }
    [[nodiscard]] constexpr unsigned char green() const noexcept
    {
        return m_g;
    }
    [[nodiscard]] constexpr unsigned char blue() const noexcept
    {
        return m_b;
    }
    virtual ~RGB() = default;
    bool operator!=(const RGB &rhs) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const RGB &RGB);

private:
    unsigned char m_r, m_g, m_b;
    [[nodiscard]] static float pivotXYZ(float n) noexcept;
};

template <>
struct std::hash<RGB> {
    size_t operator()(const RGB &rgb) const
    {
        return (rgb.red() << 16) | (rgb.green() << 8) | rgb.blue();
    }
};

class RGBCache
{
private:
    static constexpr int R_SHIFT = 16;
    static constexpr int G_SHIFT = 8;

    struct Entry {
        RGB val;
        bool init;

        Entry()
            : val{}
            , init{false}
        {
        }
    };

    std::vector<Entry> m_entries;

public:
    RGBCache()
        : m_entries(1 << 24)
    {
    }

    void set(const RGB &key, const RGB &val) noexcept
    {
        const size_t idx = makeIndex(key);
        m_entries[idx].val = val;
        m_entries[idx].init = true;
    }

    [[nodiscard]] std::optional<RGB> get(const RGB &key) const noexcept
    {
        const size_t idx = makeIndex(key);
        return m_entries[idx].init ? std::optional{m_entries[idx].val}
                                   : std::nullopt;
    }

private:
    [[nodiscard]] static constexpr size_t makeIndex(const RGB &rgb) noexcept
    {
        return (rgb.red() << R_SHIFT) | (rgb.green() << G_SHIFT) | rgb.blue();
    }
};

class RGBA : public RGB
{
public:
    explicit RGBA(unsigned char r = 0, unsigned char g = 0, unsigned char b = 0,
                  unsigned char a = 255) noexcept;
    [[nodiscard]] unsigned char alpha() const noexcept
    {
        return m_a;
    }

private:
    unsigned char m_a;
};
