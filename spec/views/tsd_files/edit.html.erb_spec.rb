require 'rails_helper'

RSpec.describe "tsd_files/edit", type: :view do
  before(:each) do
    @tsd_file = assign(:tsd_file, TsdFile.create!(
      :path => "MyString",
      :latest => false
    ))
  end

  it "renders the edit tsd_file form" do
    render

    assert_select "form[action=?][method=?]", tsd_file_path(@tsd_file), "post" do

      assert_select "input#tsd_file_path[name=?]", "tsd_file[path]"

      assert_select "input#tsd_file_latest[name=?]", "tsd_file[latest]"
    end
  end
end
