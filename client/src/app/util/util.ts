function replacer(key, value) {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      values: Array.from(value.entries()), // or with spread: value: [...value],
      keys: Array.from(value.keys()),
    };
  } else {
    return value;
  }
}

export { replacer };
