require 'rails_helper'

RSpec.describe "source_details/edit", type: :view do
  before(:each) do
    @source_detail = assign(:source_detail, SourceDetail.create!(
      :description => "MyText"
    ))
  end

  it "renders the edit source_detail form" do
    render

    assert_select "form[action=?][method=?]", source_detail_path(@source_detail), "post" do

      assert_select "textarea#source_detail_description[name=?]", "source_detail[description]"
    end
  end
end
