require 'rails_helper'

RSpec.describe "tsd_files/new", type: :view do
  before(:each) do
    assign(:tsd_file, TsdFile.new(
      :path => "MyString",
      :latest_forecast => false
    ))
  end

  it "renders new tsd_file form" do
    render

    assert_select "form[action=?][method=?]", tsd_files_path, "post" do

      assert_select "input#tsd_file_path[name=?]", "tsd_file[path]"

      assert_select "input#tsd_file_latest[name=?]", "tsd_file[latest]"
    end
  end
end
