import {
  EURO,
  INDUSTRY,
  DIMENSIONS,
  MAX_HEIGHT,
  LKW_12,
  LKW_7
} from "./constants";
import {
  removeValidatedPallets,
  getIndexOfType,
  getSortedListBy,
  unpackPalletGroups,
  copy,
  isMinSpace,
  findIndexPalletInArr
} from "./helper";

var BreakException = {};
export const validate = pallets => {
  pallets = unpackPalletGroups(pallets);
  // console.log(JSON.parse(JSON.stringify(pallets)));

  const lkwList = [LKW_12, LKW_7];
  var validated = [];
  var loadings = [];
  var lastPallet = null;
  var counter_lkw = 0;
  var currentLKW = lkwList[0];
  var indexRemove = [];
  var width_counter = 0;
  var height_counter = 0;
  var addCurrentIndex = false;
  var currentIndex = null;
  var freeSpaces = [];
  var LKW = [];
  var currentRow = [];

  const fitsHeight = pallet => {
    const { height } = DIMENSIONS[pallet.type];
    if (height_counter + height < MAX_HEIGHT) {
      return true;
    } else {
      return false;
    }
  };

  const fitsAny = height => {
    const heightLeft = MAX_HEIGHT - height_counter;

    if (height) {
      if (heightLeft >= height) {
        return true;
      } else {
        return false;
      }
    }

    if (heightLeft >= 80) {
      return true;
    } else {
      return false;
    }
  };

  const nextLkw = pallet => {
    // console.log("NEXT LKW!");
    LKW.push(currentRow);
    validated.pop();
    loadings.push({
      pallets: validated,
      lkw: currentLKW,
      arr: LKW
    });
    LKW = [];
    currentRow = [];
    validated = [];
    validated.push(pallet);

    const { height, width } = DIMENSIONS[pallet.type];

    width_counter = width;
    height_counter = height;

    counter_lkw++;
    var lkwIndex = counter_lkw % lkwList.length;
    currentLKW = lkwList[lkwIndex];
  };

  const addNewRowInLKW = (width, height, pallet) => {
    var heightLeft = MAX_HEIGHT - height_counter;
    if (heightLeft >= 80 && width_counter > 0) {
      freeSpaces.push({
        height: heightLeft,
        width: DIMENSIONS[lastPallet.type].width,
        position: validated.length - 1
      });
    }

    width_counter += width;
    height_counter = height;

    var newLkw = false;
    if (width_counter > currentLKW.maxLoading) {
      nextLkw(pallet);
      newLkw = true;
      currentRow.push(pallet);
    }

    if (!newLkw && width_counter > 0) {
      if (currentRow.length > 0) {
        LKW.push(copy(currentRow));
      }

      currentRow = [];
      currentRow.push(pallet);
    }
  };

  const addToDelivery = (pallet, index) => {
    console.log(`---Add To Delivery Index ${pallet.id}--- `);

    const { height, width } = DIMENSIONS[pallet.type];

    validated.push(copy(pallet));
    indexRemove.push(pallet.id);

    if (width_counter === 0) {
      addNewRowInLKW(width, height, pallet);
    } else if (!fitsAny(height)) {
      addNewRowInLKW(width, height, pallet);
    } else {
      currentRow.push(copy(pallet));

      height_counter += height;
    }

    lastPallet = pallet;

    // console.log(`STATUS: WIDTH: ${width_counter} HEIGHT ${height_counter}`);
  };

  const validateIfPalletToFindIsSingle = (availablePallets, typeToFind) => {
    var indexOfType = getIndexOfType(availablePallets, typeToFind);
    var quantity = typeToFind === EURO ? 2 : 1;

    if (indexOfType.length === quantity) {
      return indexOfType;
    } else {
      return false;
    }
  };

  const getPalletsOfType = (type, availablePallets) => {
    return availablePallets.filter(pallet => pallet.type === type);
  };

  const isOddQuantityOfType = (type, availablePallets) => {
    var palletsOfType = getPalletsOfType(type, availablePallets);
    // console.log(palletsOfType);

    var divider = type === EURO ? 3 : 2;
    return palletsOfType.length % divider !== 0;
  };

  const validateIfPalletToFindIsOddQuantity = (
    availablePallets,
    typeToFind
  ) => {
    // console.log("validateIfPalletToFindIsOddQuantity...", typeToFind);

    const allTypes = getSortedListBy(typeToFind);
    var indexOfType = null;

    allTypes.forEach(type => {
      if (!indexOfType) {
        var isOdd = isOddQuantityOfType(type, availablePallets);
        // console.log("IS ODD !!!", isOdd, availablePallets);
        if (isOdd) {
          indexOfType = getIndexOfType(availablePallets, type);
          if (type !== typeToFind) {
            // console.log("CURRENT INDEX!!!!!!!!!!!!!!!!!!!!!");
            addCurrentIndex = currentIndex;
          }
        }
      }
    });
    if (indexOfType) {
      return [indexOfType[0]];
    } else {
      return false;
    }
  };

  const findSinglePalletIndex = (availablePallets, typeToFind) => {
    // console.log("findSinglePalletIndex availablePallets", availablePallets);

    var indexFound = validateIfPalletToFindIsSingle(
      availablePallets,
      typeToFind
    );

    indexFound = validateIfPalletToFindIsOddQuantity(
      availablePallets,
      typeToFind
    );

    if (indexFound) return indexFound;
  };

  const addPalletsOfIndexToDelivery = (pallets, index, indexList) => {
    // console.log("addPalletsOfIndexToDelivery ", pallets, index, indexList);

    if (addCurrentIndex) {
      addToDelivery(pallets[currentIndex], currentIndex);
    }

    indexList.forEach(index_ => {
      const indexAdd = index + index_ + 1;
      const palletToAdd = pallets[indexAdd];
      addToDelivery(palletToAdd, indexAdd);
    });

    throw BreakException;
  };

  const validateIfOtherPalletFits = (pallet, index, typeToFind) => {
    // console.log("validateIfOtherPalletFits...", typeToFind);

    var availablePallets = pallets.slice(index + 1);

    const indexList = findSinglePalletIndex(availablePallets, typeToFind);

    if (indexList) {
      addPalletsOfIndexToDelivery(pallets, index, indexList);
    } else {
      return false;
    }
  };

  const handlePalletOnNextRow = (pallet, index) => {
    console.log("handlePalletOnNextRow...");
    addToDelivery(pallet, index);
  };

  const handlePalletFitsPerfectOnRow = (pallet, index) => {
    // console.log("handlePalletOnNextRow...");
    addToDelivery(pallet, index);
  };

  const handlePalletFitsNotPerfectOnRow = (pallet, index, heightLeft) => {
    // console.log("handlePalletFitsNotPerfectOnRow...", heightLeft);
    const type = pallet.type;

    if (heightLeft >= 80) {
      addToDelivery(pallet, index);
    } else if (type === EURO && heightLeft > 40 && heightLeft < 80) {
      validateIfOtherPalletFits(pallet, index, INDUSTRY);
    } else if (type === INDUSTRY && heightLeft > 40 && heightLeft < 120) {
      validateIfOtherPalletFits(pallet, index, EURO);
    }
  };

  const handlePalletDoesNotFit = (pallet, index, heightLeft) => {
    // console.log("handlePalletDoesNotFit...");
    const type = pallet.type;
    const { height } = DIMENSIONS[pallet.type];

    heightLeft += height;

    if (type === INDUSTRY && heightLeft >= 80) {
      var typeToFind = EURO;
    }

    if (!validateIfOtherPalletFits(pallet, index, typeToFind)) {
      // console.log("PALLET ADD TO DELIVER !!!!!!!!!!!!");
      addToDelivery(pallet, index);
    }
  };

  const sort_ = pallets_ => {
    pallets_.forEach((pallet, index) => {
      console.log(`------------${pallet.id}----------`);

      currentIndex = index;
      addCurrentIndex = false;

      const { height } = DIMENSIONS[pallet.type];
      const heightLeft = MAX_HEIGHT - height_counter - height;

      if (!fitsAny()) {
        handlePalletOnNextRow(pallet, index);
      } else if (fitsHeight(pallet) && heightLeft < 20) {
        handlePalletFitsPerfectOnRow(pallet, index);
      } else if (fitsHeight(pallet) && heightLeft >= 20) {
        handlePalletFitsNotPerfectOnRow(pallet, index, heightLeft);
      } else {
        handlePalletDoesNotFit(pallet, index, heightLeft);
      }
    });
  };

  for (var xx = 0; xx < 100; xx++) {
    pallets = removeValidatedPallets(pallets, indexRemove);

    if (pallets.length === 0) break;

    try {
      indexRemove = [];
      sort_(pallets);
    } catch (e) {
      if (e !== BreakException) {
        throw e;
      }
    }
  }

  if (validated) {
    LKW.push(currentRow);
    loadings.push({
      //   pallets: validated,
      lkw: currentLKW,
      arr: LKW
    });
  }

  createLoading(loadings);
  findFreeSpaces(loadings);
  insertFreeSpacesInto(loadings);
  console.log("loadings", loadings);

  console.log("loadings2 = ", loadings);

  // console.log("LOADINGS", loadings);
  // console.log("validated", validated);
  // console.log("freeSpaces", freeSpaces);

  //   freeSpaces.forEach(space => {
  //     var index_ = space.position;
  //     loadings[0].pallets.splice(index_, 0, space);
  //   });

  return loadings;
};

const insertFreeSpacesInto = loadings => {
  console.log("insertFreeSpacesInto", loadings);

  const loopLoadings = loadings => {
    const insertSpace = space => {
      console.log("insert space..", space);

      currentLoading.pallets.splice(space.palletIndex, 0, space);
    };

    const loopSpaces = freeSpaces => {
      freeSpaces.forEach(space => {
        insertSpace(space);
      });
    };

    var currentLoading = null;
    loadings.forEach(loading => {
      currentLoading = loading;
      loopSpaces(loading.freeSpaces);
    });
  };

  loopLoadings(loadings);
};

const findFreeSpaces = loadings => {
  const addToFreeSpaces = (width, height, type) => {
    freeSpaces.push({
      freeSpaceType: type,
      height,
      width,
      position: {
        row: rowCounter,
        column: columnCounter
      },
      palletIndex: palletIndexCounter
    });
    palletIndexCounter++;
  };

  const validateTotalWidth = loading => {
    const freeTotalWidth = currentLKW.maxLoading - totalWidth;

    rowCounter = 0;
    palletIndexCounter++;

    if (isMinSpace(freeTotalWidth, currentLKW.maxHeight)) {
      addToFreeSpaces(freeTotalWidth, currentLKW.maxHeight, "end");
    }
    loading["freeSpaces"] = freeSpaces;
    loading["totalWidth"] = totalWidth;
  };

  const resetTempValues = () => {
    freeSpaces = [];
    totalWidth = 0;
    columnCounter = 0;

    palletIndexCounter = 0;
  };

  const validateColumn = column => {
    const validateColumnValues = () => {
      const freeHeight = currentLKW.maxHeight - currentHeight;
      const freeWidth = currentMaxWidth;

      if (isMinSpace(freeWidth, freeHeight)) {
        addToFreeSpaces(currentMaxWidth, freeHeight, "filler");
      }

      totalWidth += currentMaxWidth;
      rowCounter = 0;
    };

    const updateColumnValues = (width, height) => {
      rowCounter++;
      palletIndexCounter++;
      currentHeight += height;
      if (width > currentMaxWidth) {
        currentMaxWidth = width;
      }
    };

    const loopColumn = () => {
      column.forEach(pallet => {
        const { width, height } = DIMENSIONS[pallet.type];
        updateColumnValues(width, height);
      });
    };

    var currentHeight = 0;
    var currentMaxWidth = 0;
    loopColumn();
    validateColumnValues(currentMaxWidth, currentHeight);
  };

  const loopLoadingArr = arr => {
    arr.forEach(column => {
      validateColumn(column);
      columnCounter++;
    });
  };

  const loopLoadings = loadings => {
    loadings.forEach(loading => {
      var { lkw, arr } = loading;
      currentLKW = lkw;

      loopLoadingArr(arr);
      validateTotalWidth(loading);
      resetTempValues();
    });
  };

  var currentLKW = null;
  var freeSpaces = [];
  var totalWidth = 0;
  var rowCounter = 0;
  var columnCounter = 0;
  var palletIndexCounter = 0;
  loopLoadings(loadings);
};

const reorderLoadings_ = trucks => {
  var currentLKW = null;
  var freeSpaces = [];
  var totalWidth = 0;
  var rowCounter = 0;
  var columnCounter = 0;
  var palletIndexCounter = 0;

  const validateColumn = column => {
    const updateColumnValues = (pallet, height, width) => {
      currentHeight += height;

      if (totalWidth + width > currentLKW.lkw.maxLoading) {
        palletsMoveLKW.push(pallet);
      } else if (currentHeight > 240) {
        palletsToMoveNextRow.push(copy(pallet));
        removeLastPallet = true;
      } else if (width > currentMaxWidth) {
        currentMaxWidth = width;
      }
    };

    const loopColumn = () => {
      column.forEach(pallet => {
        const { height, width } = DIMENSIONS[pallet.type];
        if (palletsToMoveNextRow.length > 0) {
          palletsToMoveNextRow.push(copy(pallet));
        } else {
          updateColumnValues(pallet, height, width);
        }
      });
    };

    const removeFromColumn = pallet => {
      const indexRemove = findIndexPalletInArr(copy(currentLKW), pallet.id);
      alert("NEEDS TO BE IMPLEMENTTED 'removeFromColumn'");
    };

    const finishColumn = () => {
      totalWidth += currentMaxWidth;
      if (removeLastPallet) {
        palletsToMoveNextRow.forEach(pallet_ => {
          column.pop();
        });
      }
      if (palletsMoveLKW.length > 0) {
        palletsMoveLKW.forEach(palletToMove => {
          removeFromColumn(palletToMove);
        });
      }
    };

    var currentHeight = 0;
    var currentMaxWidth = 0;
    var removeLastPallet = false;

    loopColumn();

    finishColumn();
  };

  const validateTruck = truck => {
    truck.arr.forEach(column => {
      if (palletsToMoveNextRow) {
        palletsToMoveNextRow.forEach(palletInsert => {
          column.splice(0, 0, palletInsert);
        });

        palletsToMoveNextRow = [];
      }

      validateColumn(column);
    });
  };

  const validateTrucks = trucks => {
    trucks.forEach(truck => {
      currentLKW = truck;

      validateTruck(truck);
      totalWidth = 0;
    });
    if (palletsToMoveNextRow.length > 0) {
      trucks[trucks.length - 1].arr.push(palletsToMoveNextRow);
      palletsToMoveNextRow = [];
      palletsMoveLKW = [];
      validateTrucks(trucks);
    }
  };

  var totalWidth = 0;
  var palletsToMoveNextRow = [];
  var palletsMoveLKW = [];
  var currentLKW = null;

  validateTrucks(trucks);
  console.log("trucks end = ", trucks);

  createLoading(trucks);
  findFreeSpaces(trucks);
  console.log("FREE SPACES", trucks.freeSpaces);

  insertFreeSpacesInto(trucks);
  console.log("end //// trucks", trucks);
};

const createLoading = trucks => {
  trucks = trucks.map(truck => {
    var palletsTruck = [];

    truck.arr.forEach(column => {
      column.forEach(pallet => {
        palletsTruck.push(pallet);
      });
    });

    truck.pallets = palletsTruck;
    return truck;
  });
};

export const reorderLoadings = reorderLoadings_;
