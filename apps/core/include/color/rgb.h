#pragma once

#include <cstdint>
#include <iostream>
#include <list>
#include <optional>
#include <unordered_map>
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

struct RGBA {
    uint8_t r, g, b, a;

    constexpr explicit RGBA(uint8_t r = 0, uint8_t g = 0, uint8_t b = 0,
                            uint8_t a = 255) noexcept
        : r(r)
        , g(g)
        , b(b)
        , a(a)
    {
    }

    bool operator==(const RGBA &rhs) const noexcept = default;
    bool operator!=(const RGBA &rhs) const noexcept = default;

    friend std::ostream &operator<<(std::ostream &os, const RGBA &RGBA);
};

struct RGB {
    uint8_t r, g, b;

    constexpr explicit RGB(uint8_t r = 0, uint8_t g = 0, uint8_t b = 0) noexcept
        : r(r)
        , g(g)
        , b(b)
    {
    }
    explicit RGB(const RGBA &rgba)
        : r(rgba.r)
        , g(rgba.g)
        , b(rgba.b)
    {
    }

    constexpr RGB(std::initializer_list<uint8_t> il) noexcept
    {
        auto it = il.begin();
        r = it != il.end() ? *it++ : 0;
        g = it != il.end() ? *it++ : 0;
        b = it != il.end() ? *it : 0;
    }

    [[nodiscard]] Lab toLab() const noexcept;

    bool operator==(const RGB &rhs) const noexcept = default;
    bool operator!=(const RGB &rhs) const noexcept = default;

    friend std::ostream &operator<<(std::ostream &os, const RGB &RGB);
};

namespace std {
template <>
struct hash<RGB> {
    size_t operator()(const RGB &rgb) const
    {
        return (static_cast<size_t>(rgb.r) << 16) |
               (static_cast<size_t>(rgb.g) << 8) | rgb.b;
    }
};
};  // namespace std

class ThreadLocalCache
{
private:
    static constexpr size_t MAX_CACHE_SIZE = 4096;

    std::list<RGB> m_lruList;
    // Map RGB -> {Value, Iterator to key in m_lruList}
    std::unordered_map<RGB, std::pair<RGBA, std::list<RGB>::iterator>,
                       std::hash<RGB>>
        m_cache;

    void markAsUsed(typename std::unordered_map<
                    RGB, std::pair<RGBA, std::list<RGB>::iterator>,
                    std::hash<RGB>>::iterator map_it)
    {
        // Use splice to move the node pointed to by map_it->second.second
        // to the beginning of m_lruList without allocation/deallocation
        m_lruList.splice(m_lruList.begin(), m_lruList, map_it->second.second);
        map_it->second.second = m_lruList.begin();
    }

public:
    void set(const RGBA &key, const RGBA &val) noexcept
    {
        RGB rgbKey(key);
        auto it = m_cache.find(rgbKey);

        if (it != m_cache.end())
        {
            // Key exists: Update value and mark as recently used
            it->second.first = val;
            markAsUsed(it);
        }
        else
        {
            // Key doesn't exist: Insert new element
            if (m_cache.size() >= MAX_CACHE_SIZE)
            {
                // Cache is full: Evict least recently used
                RGB lruKey = m_lruList.back();
                m_lruList.pop_back();
                m_cache.erase(lruKey);
            }

            m_lruList.push_front(rgbKey);
            // Use emplace for potentially better performance constructing in place
            m_cache.emplace(rgbKey, std::make_pair(val, m_lruList.begin()));
            // Note: If emplace fails (e.g., duplicate key inserted between find and emplace
            // in a concurrent scenario - not possible here due to thread_local),
            // the list push_front would need rollback. But for thread_local, this is safe.
        }
    }

    [[nodiscard]] std::optional<RGBA> get(const RGBA &key) noexcept
    {
        RGB rgbKey(key);
        auto it = m_cache.find(rgbKey);

        if (it != m_cache.end())
        {
            markAsUsed(it);
            return std::optional{it->second.first};
        }
        return std::nullopt;
    }

    void clear() noexcept
    {
        m_lruList.clear();
        m_cache.clear();
    }
};
