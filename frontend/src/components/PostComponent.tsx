export default function PostComponent({
  title = "Post title",
  user = "arnavchopra",
  description = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Rem porro consequatur impedit dolor, soluta rerum mollitia ut eos fugiat! Amet nam voluptate quos delectus rem enim veritatis eius iste! Et.",
  image = "",
}: {
  title: string;
  user: string;
  description: string;
  image: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 w-full max-w-[1000px] space-y-2 p-3">
      <div className=" text-slate-800">
        <span className="font-semibold"> @{user} </span>
        posted
      </div>
      <div className="text-2xl font-bold">{title}</div>
      <img src={image} style={{ width: '300px', height: '200px' }} />
      <div className="">{description}</div>
    </div>
  );
}
