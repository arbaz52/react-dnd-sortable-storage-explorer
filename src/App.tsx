import {
  FaFolder,
  FaAngleRight,
  FaFolderPlus,
  FaFileCirclePlus,
  FaAngleDown,
  FaFile,
  FaFolderOpen,
} from "react-icons/fa6";
import { produce } from "immer";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { ComponentProps, FC, PropsWithChildren } from "react";
import { atomFamily, selectAtom } from "jotai/utils";
import { Disclosure } from "@headlessui/react";
import { tv } from "tailwind-variants";

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
  children: { [id: string]: IItem };
};

const generateId = () => Math.random().toString(32).slice(2);

const rootId = generateId();

const storeAtom = atom<IStore>({
  rootId,
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
  },
});

const NavigatorItem: FC<{ itemId: string }> = ({ itemId }) => {
  const item = useAtomValue(itemFamily(itemId));
  const [selectedFolder, selectFolder] = useAtom(openedFolderIdAtom);

  const selected = selectedFolder === item.id;

  if (!item) return <></>;

  if (item.type === EItem.FILE)
    return (
      <div className={navigatorItem({})}>
        <FaFile /> <span className="flex-1 text-left">{item.id}.file</span>
      </div>
    );

  if (item.type === EItem.FOLDER)
    return (
      <Disclosure defaultOpen={selected}>
        {({ open }) => (
          <div className="w-full">
            <Disclosure.Button
              onClick={() => selectFolder(item.id)}
              className={navigatorItem({ selected })}
            >
              {selected ? <FaFolderOpen /> : <FaFolder />}{" "}
              <span className="flex-1 text-left">{item.id}</span>
              {open ? <FaAngleDown /> : <FaAngleRight />}
            </Disclosure.Button>
            <Disclosure.Panel className="ml-2">
              {item.childrenIds.map((childId) => (
                <NavigatorItem itemId={childId} />
              ))}
            </Disclosure.Panel>
          </div>
        )}
      </Disclosure>
    );

  return <></>;
};

const Navigator: FC = () => {
  const rootId = useAtomValue(rootIdAtom);
  return (
    <div className="bg-gray-100 w-1/3 h-full flex flex-col">
      <Header title="Navigator" />
      <div className="flex flex-col overflow-auto py-4">
        <NavigatorItem itemId={rootId} />
      </div>
    </div>
  );
};

const App: FC = () => {
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
