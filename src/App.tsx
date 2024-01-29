import {
  FaFile,
  FaFolder,
  FaAngleDown,
  FaFolderOpen,
  FaAngleRight,
  FaFolderPlus,
  FaFileCirclePlus,
} from "react-icons/fa6";
import {
  FC,
  useRef,
  useState,
  useEffect,
  ComponentProps,
  PropsWithChildren,
} from "react";
import { produce } from "immer";
import { tv } from "tailwind-variants";
import { atomFamily, selectAtom } from "jotai/utils";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";

enum EItem {
  FILE = "FILE",
  FOLDER = "FOLDER",
}

type IFile = IBaseItem<{
  type: EItem.FILE;
}>;

type IFolder = IBaseItem<{
  childrenIds: string[];
  type: EItem.FOLDER;
}>;

type IBaseItem<T extends object> = {
  id: string;
  parentId: string | null;
} & T;

type IItem = IFile | IFolder;

type IStore = {
  rootId: string;
  openedFolderId: string;
  dragItemId: string | null;
  children: { [id: string]: IItem };
};

const generateId = () => Math.random().toString(32).slice(2);

const rootId = generateId();

const storeAtom = atom<IStore>({
  rootId,
  dragItemId: null,
  openedFolderId: rootId,
  children: {
    [rootId]: {
      id: rootId,
      parentId: null,
      childrenIds: [],
      type: EItem.FOLDER,
    },
  },
} satisfies IStore);

const rootIdAtom = selectAtom(storeAtom, (store) => store.rootId);
const openedFolderIdAtom = atom(
  (get) => get(storeAtom).openedFolderId,
  (get, set, folderId: string) =>
    set(
      storeAtom,
      produce(get(storeAtom), (draft) => {
        draft.openedFolderId = folderId;
      }),
    ),
);
const dragItemIdAtom = atom(
  (get) => get(storeAtom).dragItemId,
  (get, set, folderId: string | null) =>
    set(
      storeAtom,
      produce(get(storeAtom), (draft) => {
        draft.dragItemId = folderId;
      }),
    ),
);

const itemFamily = atomFamily((itemId: string) =>
  atom((get) => get(storeAtom).children[itemId]),
);

const createItemAtom = atom(null, (get, set, type: EItem) => {
  const id = generateId();
  const store = get(storeAtom);
  const parentId = store.openedFolderId;

  const item: IItem = (() => {
    switch (type) {
      case EItem.FILE:
        return {
          id,
          parentId,
          type: EItem.FILE,
        };
      case EItem.FOLDER:
        return {
          id,
          parentId,
          childrenIds: [],
          type: EItem.FOLDER,
        };
    }
  })();

  const update = produce(store, (draft) => {
    draft.children[id] = item;
    (draft.children[parentId] as IFolder).childrenIds.push(id);
  });

  set(storeAtom, update);
});

const moveAtom = atom(
  null,
  (
    get,
    set,
    props: {
      dragItemId: string;
      dropItemId: string;
      hovering: "above" | "below";
    },
  ) => {
    const { dragItemId, dropItemId, hovering } = props;
    const store = get(storeAtom);

    const update = produce(store, (draft) => {
      const dragItem = draft.children[dragItemId];
      const dragItemParent = draft.children[
        dragItem.parentId || draft.rootId
      ] as IFolder;
      const dropItem = draft.children[dropItemId];
      const dropItemParent = draft.children[
        dropItem.parentId || draft.rootId
      ] as IFolder;

      // unlink from parent
      const dragItemIndex = dragItemParent.childrenIds.indexOf(dragItemId);
      dragItemParent.childrenIds.splice(dragItemIndex, 1);

      if (dropItem.type === EItem.FOLDER && hovering === "below") {
        // link to new parent
        if (!dropItem.childrenIds.includes(dragItemId))
          dropItem.childrenIds.unshift(dragItemId);

        // assign new parent
        dragItem.parentId = dropItem.id;
      } else {
        const dropItemIndex = dropItemParent.childrenIds.indexOf(dropItemId);

        const newIndex =
          hovering === "above" ? dropItemIndex : dropItemIndex + 1;

        if (newIndex < 0) dropItemParent.childrenIds.unshift(dragItemId);
        else dropItemParent.childrenIds.splice(newIndex, 0, dragItemId);

        // assign new parent
        dragItem.parentId = dropItemParent.id;
      }
    });

    set(storeAtom, update);
  },
);

const Header: FC<{ title: string } & PropsWithChildren> = ({
  title,
  children,
}) => {
  return (
    <div className="h-12 px-4 flex items-center border-b flex-shrink-0">
      <div className="">{title}</div>
      {children}
    </div>
  );
};

const IconButton: FC<ComponentProps<"div">> = ({ children, ...props }) => (
  <div
    {...props}
    className="w-8 h-8 rounded-md flex items-center justify-center text-sm bg-gray-100 hover:bg-gray-200 active:bg-gray-300 cursor-pointer"
  >
    {children}
  </div>
);

const Folder: FC<{ folderId: string }> = ({ folderId }) => {
  const createItem = useSetAtom(createItemAtom);

  const item = useAtomValue(itemFamily(folderId));

  if (!item) return <></>;

  return (
    <div className="flex-1 flex flex-col">
      <Header title={item.id}>
        <div className="flex-1 flex justify-end gap-3">
          <IconButton onClick={() => createItem(EItem.FOLDER)}>
            <FaFolderPlus />
          </IconButton>
          <IconButton onClick={() => createItem(EItem.FILE)}>
            <FaFileCirclePlus />
          </IconButton>
        </div>
      </Header>
    </div>
  );
};

const navigatorItem = tv({
  base: "flex-shrink-0 w-full px-4 text-sm h-8 py-1 flex gap-2 items-center hover:bg-gray-200 active:bg-gray-300 select-none",
  variants: {
    selected: {
      true: "bg-gray-300 hover:bg-gray-300",
    },
    hide: {
      true: "opacity-0",
    },
  },
});

const useDisclosure = (defaultValue = false) => {
  const [isOpen, setIsOpen] = useState(defaultValue);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);
  const toggle = () => setIsOpen((pv) => !pv);

  return {
    open,
    close,
    toggle,
    isOpen,
  };
};

interface IDragPayload {
  itemId: string;
}

const NavigatorItem: FC<{ itemId: string }> = ({ itemId }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const item = useAtomValue(itemFamily(itemId));
  const [dragItemId, setDragItemId] = useAtom(dragItemIdAtom);
  const [selectedFolder, selectFolder] = useAtom(openedFolderIdAtom);

  const hide = dragItemId === item.id;

  const selected = selectedFolder === item.id;

  const { isOpen, close, open, toggle } = useDisclosure(selected);

  const move = useSetAtom(moveAtom);

  const [{ isDragging }, connectDrag] = useDrag(
    () => ({
      item: { itemId: item.id } satisfies IDragPayload,
      type: item.type,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [item.type, item.id],
  );

  useEffect(() => {
    setDragItemId(isDragging ? item.id : null);
  }, [isDragging, item.id, setDragItemId]);

  const [, connectDrop] = useDrop(
    () => ({
      accept: [EItem.FILE, EItem.FOLDER],
      hover: (dragItem: IDragPayload, monitor) => {
        const dragItemId = dragItem.itemId;

        if (dragItemId === item.id) return;

        const draggingOffset = monitor.getClientOffset();
        if (!draggingOffset) return;

        const { y } = draggingOffset;

        const dropRect = ref.current?.getBoundingClientRect();

        if (!dropRect) return;

        if (item.type === EItem.FOLDER) {
          open();
        }

        const hovering =
          y < dropRect.height / 2 + dropRect.y ? "above" : "below";

        move({ dragItemId, dropItemId: item.id, hovering });
      },
    }),
    [item, open, move],
  );

  useEffect(() => {
    if (isDragging) {
      close();
    }
  }, [close, isDragging]);

  connectDrop(connectDrag(ref));

  if (!item) return <></>;

  if (item.type === EItem.FILE)
    return (
      <div ref={ref} className={navigatorItem({ hide })}>
        <FaFile /> <span className="flex-1 text-left">{item.id}.file</span>
      </div>
    );

  if (item.type === EItem.FOLDER)
    return (
      <div className="w-full">
        <div
          ref={ref}
          onClick={() => {
            toggle();
            selectFolder(item.id);
          }}
          className={navigatorItem({ selected, hide })}
        >
          {selected ? <FaFolderOpen /> : <FaFolder />}{" "}
          <span className="flex-1 text-left">{item.id}</span>
          {isOpen ? <FaAngleDown /> : <FaAngleRight />}
        </div>
        {isOpen && (
          <div className="flex flex-col ml-2">
            {item.childrenIds.map((childId) => (
              <NavigatorItem key={childId} itemId={childId} />
            ))}
          </div>
        )}
      </div>
    );

  return <></>;
};

const Navigator: FC = () => {
  const rootId = useAtomValue(rootIdAtom);
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="bg-gray-100 w-1/3 h-full flex flex-col">
        <Header title="Navigator" />
        <div className="flex flex-col overflow-auto py-4">
          <NavigatorItem itemId={rootId} />
        </div>
      </div>
    </DndProvider>
  );
};

const App: FC = () => {
  // console.debug(JSON.stringify(useAtomValue(storeAtom), null, 2));
  const openedFolderId = useAtomValue(openedFolderIdAtom);
  return (
    <div className="w-[100svw] h-[100svh] bg-gray-50 flex items-center justify-center">
      <div className="max-w-3xl w-full aspect-video bg-white shadow rounded-md flex">
        <Navigator />
        {openedFolderId && <Folder folderId={openedFolderId} />}
      </div>
    </div>
  );
};

export default App;
